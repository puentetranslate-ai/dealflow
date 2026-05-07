// Stripe webhook receiver — keeps `profiles.subscription_status` and
// related fields in sync with payment events. No `stripe` npm package
// needed: signature verification is done with node:crypto, which keeps
// the bundle tiny and avoids ESM/CJS interop pain on Vercel.
//
// Required env vars:
//   STRIPE_WEBHOOK_SECRET       Stripe Dashboard → Webhooks → "Signing secret"
//                               (whsec_…). One per webhook endpoint.
//   SUPABASE_SERVICE_ROLE_KEY   Used to upsert profiles + write audit_log.
//
// Events handled:
//   checkout.session.completed       → subscription_status='active',
//                                      stripe_customer_id stored
//   customer.subscription.created    → captures price_id → subscription_tier
//   customer.subscription.updated    → tier changes, cancel-at-period-end
//   customer.subscription.deleted    → subscription_status='cancelled'
//   invoice.payment_failed           → grace_period_ends_at = now + 7 days,
//                                      status NOT changed (don't auto-cancel)
//   invoice.payment_succeeded        → clear grace_period_ends_at
//
// Every event — handled or not — gets inserted into public.audit_log.
// The unique (stripe_event_id) constraint on that table makes the whole
// handler idempotent: if Stripe retries an event, the duplicate insert
// fails and we bail out before re-processing.
//
// Stripe Dashboard configuration:
//   Endpoint URL:  https://dealflownow.net/api/stripe-webhook
//   Events to send: checkout.session.completed, customer.subscription.*,
//                   invoice.payment_failed, invoice.payment_succeeded

import { createHmac, timingSafeEqual } from 'node:crypto'

// Vercel: turn off the default body parser so we can read the raw bytes.
// Stripe signs the exact byte sequence — any reformatting (even adding
// or removing whitespace) breaks verification.
export const config = { api: { bodyParser: false } }

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'

// Reject events older than 5 minutes — defense against replayed signatures.
const MAX_EVENT_AGE_SECONDS = 300

// ───────────────────────────────────────────────────────────────────
// Stripe price ID → tier name mapping. Update this when you create new
// products in the Stripe dashboard. Anything not listed defaults to 'beta'
// (the current $30 + $15/mo plan from the Day 25 email) so unknown prices
// are still attributed to a real bucket instead of NULL.
//
// Find IDs at: Stripe Dashboard → Products → <product> → Pricing → API ID
// They look like 'price_1ABCxyz…'.
// ───────────────────────────────────────────────────────────────────
const PRICE_ID_TO_TIER = {
  'price_1TP134LyOY8ujBqf8YnCm1DM': 'beta', // $15/mo DealFlow Monthly subscription
  'price_1TRYJ0LyOY8ujBqfuIg0UBgN': 'beta', // $30 one-time onboarding fee
  // Pro / Pro+ / Intelligence price IDs go here once those products exist:
  // 'price_...': 'pro',
  // 'price_...': 'pro_plus',
  // 'price_...': 'intelligence',
}
const DEFAULT_TIER = 'beta'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method-not-allowed' })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!webhookSecret || !serviceKey) {
    console.error('[stripe-webhook] missing STRIPE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY')
    // 503 not 500 — config error, not a Stripe problem. Stripe retries 5xx.
    return res.status(503).json({ error: 'service-unavailable' })
  }

  // ─── Read raw body ────────────────────────────────────────────────
  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (e) {
    console.error('[stripe-webhook] body read failed', e)
    return res.status(400).json({ error: 'bad-request' })
  }

  // ─── Verify signature ────────────────────────────────────────────
  const signatureHeader = req.headers['stripe-signature']
  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    console.error('[stripe-webhook] signature verification failed')
    return res.status(400).json({ error: 'invalid-signature' })
  }

  // ─── Parse the event ──────────────────────────────────────────────
  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'invalid-json' })
  }
  if (!event?.id || !event?.type) {
    return res.status(400).json({ error: 'malformed-event' })
  }

  // ─── Idempotency: insert audit_log first ─────────────────────────
  // Unique constraint on stripe_event_id means a duplicate event from
  // Stripe's retry queue will 409 here and we'll skip the rest of the
  // handler. We still return 200 so Stripe doesn't keep retrying.
  const auditInsert = await insertAuditLog(serviceKey, {
    stripe_event_id: event.id,
    event_type: event.type,
    event_data: event,
    user_id: null, // filled in below if/when we resolve the user
  })
  if (auditInsert.duplicate) {
    console.log('[stripe-webhook] duplicate event, skipping', event.id, event.type)
    return res.status(200).json({ ok: true, duplicate: true })
  }
  if (!auditInsert.ok) {
    // Audit log failure is non-fatal but we log loudly. Continue
    // processing — losing audit history is preferable to dropping a
    // status update that affects whether a user can log in.
    console.error('[stripe-webhook] audit_log insert failed', auditInsert.error)
  }

  // ─── Dispatch ─────────────────────────────────────────────────────
  try {
    let userId = null
    switch (event.type) {
      case 'checkout.session.completed':
        userId = await onCheckoutCompleted(serviceKey, event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        userId = await onSubscriptionUpsert(serviceKey, event.data.object)
        break
      case 'customer.subscription.deleted':
        userId = await onSubscriptionDeleted(serviceKey, event.data.object)
        break
      case 'invoice.payment_failed':
        userId = await onInvoicePaymentFailed(serviceKey, event.data.object)
        break
      case 'invoice.payment_succeeded':
        userId = await onInvoicePaymentSucceeded(serviceKey, event.data.object)
        break
      default:
        console.log('[stripe-webhook] unhandled event', event.type)
    }
    // Backfill user_id on the audit row now that we know who.
    if (userId && auditInsert.id) {
      await patchAuditUserId(serviceKey, auditInsert.id, userId)
    }
    return res.status(200).json({ ok: true, type: event.type })
  } catch (e) {
    console.error('[stripe-webhook] handler error', event.type, e)
    // 500 → Stripe retries. We want that on transient failures.
    return res.status(500).json({ error: 'handler-failed' })
  }
}

// ─────────────────────────── Body / Signature ───────────────────────────
async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

// Stripe's signature format is documented at:
//   https://stripe.com/docs/webhooks#verify-manually
// Header looks like `t=1234567890,v1=<hex>,v0=<hex>` and may include
// multiple v1 entries during a key rotation window.
function verifyStripeSignature(rawBody, header, secret) {
  if (typeof header !== 'string' || !header) return false

  let timestamp = null
  const v1List = []
  for (const piece of header.split(',')) {
    const eq = piece.indexOf('=')
    if (eq < 0) continue
    const key = piece.slice(0, eq).trim()
    const val = piece.slice(eq + 1).trim()
    if (key === 't') timestamp = val
    else if (key === 'v1') v1List.push(val)
  }
  if (!timestamp || v1List.length === 0) return false

  // Reject ancient signatures — caps replay window.
  const tNum = Number(timestamp)
  if (!Number.isFinite(tNum)) return false
  const ageSec = Math.abs(Date.now() / 1000 - tNum)
  if (ageSec > MAX_EVENT_AGE_SECONDS) return false

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
  const a = Buffer.from(expected, 'hex')

  for (const v1 of v1List) {
    let b
    try { b = Buffer.from(v1, 'hex') } catch { continue }
    if (a.length !== b.length) continue
    if (timingSafeEqual(a, b)) return true
  }
  return false
}

// ─────────────────────────── Event handlers ───────────────────────────

// On checkout completion, the user has paid. Mark them active and capture
// their stripe_customer_id so future events can be looked up by ID, not
// email. Returns the resolved user_id (or null if we couldn't match).
async function onCheckoutCompleted(serviceKey, session) {
  const email = session?.customer_details?.email || session?.customer_email
  const customerId = session?.customer
  const userId = await resolveUserId(serviceKey, { email, customerId })
  if (!userId) {
    console.warn('[stripe-webhook] checkout: no user match', { email, customerId })
    return null
  }
  await patchProfile(serviceKey, userId, {
    subscription_status: 'active',
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    grace_period_ends_at: null, // clear any prior payment-failure flag
  })
  return userId
}

// Created or updated — both go through here. We pull the price ID off the
// first line item, map it to a tier, and persist. cancel_at_period_end
// gets stored so the UI can show "expires Jun 1" without changing status.
async function onSubscriptionUpsert(serviceKey, sub) {
  const customerId = sub?.customer
  const userId = await resolveUserId(serviceKey, { customerId })
  if (!userId) {
    console.warn('[stripe-webhook] subscription update: no user match', { customerId })
    return null
  }
  const priceId = sub?.items?.data?.[0]?.price?.id || null
  const tier = priceId ? (PRICE_ID_TO_TIER[priceId] || DEFAULT_TIER) : null
  const stripeStatus = sub?.status

  // Stripe sub statuses: active, trialing, past_due, canceled,
  // incomplete, incomplete_expired, unpaid, paused.
  // Map to our local statuses (trial / active / cancelled / expired):
  let localStatus = null
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    localStatus = 'active'
  } else if (stripeStatus === 'canceled') {
    localStatus = 'cancelled'
  } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
    // Don't flip to 'expired' yet — invoice.payment_failed has already
    // set a grace_period_ends_at, and onInvoicePaymentSucceeded will
    // clear it. Leave subscription_status alone here.
    localStatus = null
  }

  const update = {
    ...(localStatus ? { subscription_status: localStatus } : {}),
    ...(tier ? { subscription_tier: tier } : {}),
    ...(priceId ? { subscription_price_id: priceId } : {}),
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
  }
  await patchProfile(serviceKey, userId, update)
  return userId
}

async function onSubscriptionDeleted(serviceKey, sub) {
  const customerId = sub?.customer
  const userId = await resolveUserId(serviceKey, { customerId })
  if (!userId) {
    console.warn('[stripe-webhook] subscription deleted: no user match', { customerId })
    return null
  }
  await patchProfile(serviceKey, userId, {
    subscription_status: 'cancelled',
    cancel_at_period_end: false,
  })
  return userId
}

// Soft signal — start a grace window instead of immediately cancelling.
// Stripe's own dunning emails will keep retrying the card, and the user
// can update their payment method without losing access.
async function onInvoicePaymentFailed(serviceKey, invoice) {
  const customerId = invoice?.customer
  const email = invoice?.customer_email
  const userId = await resolveUserId(serviceKey, { customerId, email })
  if (!userId) {
    console.warn('[stripe-webhook] payment_failed: no user match', { customerId, email })
    return null
  }
  const graceEnds = new Date(Date.now() + 7 * 86400000).toISOString()
  await patchProfile(serviceKey, userId, {
    grace_period_ends_at: graceEnds,
    // Do NOT change subscription_status — that's the whole point of grace.
  })
  return userId
}

async function onInvoicePaymentSucceeded(serviceKey, invoice) {
  const customerId = invoice?.customer
  const userId = await resolveUserId(serviceKey, { customerId })
  if (!userId) return null
  await patchProfile(serviceKey, userId, {
    grace_period_ends_at: null,
  })
  return userId
}

// ─────────────────────────── DB helpers ───────────────────────────
// Resolve a Supabase user by stripe_customer_id first (cheap, indexed)
// then fall back to email lookup. Email matching does a case-insensitive
// compare against auth.users — that requires the admin endpoint because
// auth.users is not RLS-readable.
async function resolveUserId(serviceKey, { customerId, email }) {
  if (customerId) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      )
      if (r.ok) {
        const rows = await r.json()
        if (Array.isArray(rows) && rows[0]?.id) return rows[0].id
      }
    } catch (e) {
      console.error('[stripe-webhook] customer-id lookup failed', e)
    }
  }
  if (email) {
    try {
      // GoTrue admin search — matches on email substring case-insensitively.
      const r = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      )
      if (r.ok) {
        const data = await r.json()
        const users = data?.users || []
        const match = users.find(
          (u) => u.email && u.email.toLowerCase() === email.toLowerCase()
        )
        if (match?.id) return match.id
      }
    } catch (e) {
      console.error('[stripe-webhook] email lookup failed', e)
    }
  }
  return null
}

async function patchProfile(serviceKey, userId, update) {
  if (!userId || !update || Object.keys(update).length === 0) return
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(update),
    }
  )
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    console.error('[stripe-webhook] patchProfile failed', userId, r.status, detail, update)
    throw new Error(`profile update failed: ${r.status}`)
  }
}

async function insertAuditLog(serviceKey, row) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    })
    if (r.status === 409) {
      // Unique violation on stripe_event_id — duplicate delivery.
      return { ok: true, duplicate: true }
    }
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return { ok: false, error: `audit ${r.status} ${detail}` }
    }
    const data = await r.json().catch(() => null)
    const inserted = Array.isArray(data) ? data[0] : data
    return { ok: true, duplicate: false, id: inserted?.id }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function patchAuditUserId(serviceKey, auditId, userId) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/audit_log?id=eq.${encodeURIComponent(auditId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    )
  } catch (e) {
    console.error('[stripe-webhook] audit user_id backfill failed', e)
  }
}
