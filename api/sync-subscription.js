// User-triggerable subscription reconciliation. Reads the current state
// from Stripe (by the user's email) and updates the matching profile row.
// Used as an escape hatch when webhooks fail, fire out of order, or get
// dropped entirely — the user can hit "Refresh subscription status" in
// Settings and the app self-heals.
//
// Auth: caller's Supabase access token in Authorization: Bearer header.
// We validate the token against /auth/v1/user, then use the verified
// email to query Stripe — so a user can only ever sync THEIR own row.
//
// Required env vars (set in Vercel project settings):
//   SUPABASE_SERVICE_ROLE_KEY   bypasses RLS to write the profile row
//   STRIPE_SECRET_KEY           queries Stripe's customers + subscriptions
//
// Response:
//   { ok: true, found: true,  tier, status, message }   // subscription found, profile updated
//   { ok: true, found: false, message }                  // no Stripe match — nothing to update
//   { ok: false, error }                                 // auth / config / API failure

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'

// Keep in sync with PRICE_ID_TO_TIER in api/stripe-webhook.js. Duplicated
// here intentionally — the two endpoints can be deployed independently
// and we don't want a shared-module deploy ordering footgun.
const PRICE_ID_TO_TIER = {
  'price_1TP134LyOY8ujBqf8YnCm1DM': 'beta', // $15/mo DealFlow Monthly subscription
  'price_1TRYJ0LyOY8ujBqfuIg0UBgN': 'beta', // $30 one-time onboarding fee
  'price_1TUc0bLyOY8ujBqfMk6pQOey': 'pro',  // $20/mo DealFlow Pro
}
const DEFAULT_TIER = 'beta'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method-not-allowed' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!serviceKey || !stripeSecret) {
    console.error('[sync-subscription] missing SUPABASE_SERVICE_ROLE_KEY or STRIPE_SECRET_KEY')
    return res.status(503).json({ ok: false, error: 'service-unavailable' })
  }

  // ── Validate the caller's Supabase token ──
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  const userToken = authHeader.slice('Bearer '.length)

  let userId, email
  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${userToken}`, apikey: serviceKey },
    })
    if (!meRes.ok) {
      return res.status(401).json({ ok: false, error: 'invalid-token' })
    }
    const me = await meRes.json()
    userId = me?.id
    email = me?.email
    if (!userId || !email) {
      return res.status(401).json({ ok: false, error: 'token-missing-id-or-email' })
    }
  } catch (e) {
    console.error('[sync-subscription] token check failed', e)
    return res.status(500).json({ ok: false, error: 'auth-check-failed' })
  }

  // ── Find Stripe customer(s) with this email ──
  let customers
  try {
    const search = await stripeGet(
      `/customers?email=${encodeURIComponent(email)}&limit=10`,
      stripeSecret
    )
    customers = search?.data || []
  } catch (e) {
    console.error('[sync-subscription] customer search failed', e)
    return res.status(502).json({ ok: false, error: 'stripe-customer-search-failed' })
  }

  if (customers.length === 0) {
    return res.status(200).json({
      ok: true,
      found: false,
      message: 'No Stripe customer found for your email. If you paid with a different email, check your Stripe receipt.',
    })
  }

  // ── For each customer, look for an active or trialing subscription ──
  // A user might have multiple Stripe customers if they tried checkout
  // more than once. Walk all of them and prefer the active subscription.
  let bestSub = null
  let bestCustomer = null
  for (const customer of customers) {
    let subs
    try {
      const list = await stripeGet(
        `/customers/${customer.id}/subscriptions?status=all&limit=10`,
        stripeSecret
      )
      subs = list?.data || []
    } catch (e) {
      console.warn('[sync-subscription] subscription list failed', customer.id, e.message)
      continue
    }
    for (const sub of subs) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        bestSub = sub
        bestCustomer = customer
        break
      }
    }
    if (bestSub) break
  }

  if (!bestSub) {
    // Customer exists but no active subscription. Surface what we found
    // so the user can tell whether they paid + cancelled, or a payment
    // never went through, etc.
    return res.status(200).json({
      ok: true,
      found: false,
      message: 'No active subscription found in Stripe. Your Stripe customer record exists, but no subscription is currently active or trialing.',
      stripeCustomerCount: customers.length,
    })
  }

  // ── Map the price to a local tier and update the profile ──
  const priceId = bestSub.items?.data?.[0]?.price?.id || null
  const tier = priceId ? (PRICE_ID_TO_TIER[priceId] || DEFAULT_TIER) : DEFAULT_TIER

  try {
    const patch = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          subscription_status: 'active',
          subscription_tier: tier,
          ...(priceId ? { subscription_price_id: priceId } : {}),
          stripe_customer_id: bestCustomer.id,
          cancel_at_period_end: Boolean(bestSub.cancel_at_period_end),
          grace_period_ends_at: null,
        }),
      }
    )
    if (!patch.ok) {
      const detail = await patch.text().catch(() => '')
      console.error('[sync-subscription] profile patch failed', patch.status, detail)
      return res.status(500).json({ ok: false, error: 'profile-update-failed' })
    }
  } catch (e) {
    console.error('[sync-subscription] profile patch exception', e)
    return res.status(500).json({ ok: false, error: 'profile-update-failed' })
  }

  console.log('[sync-subscription] reconciled', { userId, email, tier, priceId })
  return res.status(200).json({
    ok: true,
    found: true,
    tier,
    status: 'active',
    message: `Subscription reconciled. You're now on the ${tier} tier — refresh the page to see Pro features unlock.`,
  })
}

// ─────────────────────────── Stripe API helper ───────────────────────────
async function stripeGet(path, secretKey) {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`Stripe ${path} returned ${resp.status}: ${detail}`)
  }
  return resp.json()
}
