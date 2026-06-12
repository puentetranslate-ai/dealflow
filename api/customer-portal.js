// Customer-portal session creator. Called by the Settings →
// "Manage Subscription" button. In Stripe live mode there's no static
// portal login URL — each session has to be created on the fly via
// Stripe's API and the returned temp URL is what the user follows.
//
// Auth: caller's Supabase access token in Authorization: Bearer header.
// We validate the token against /auth/v1/user, then use the verified
// user_id to look up the matching stripe_customer_id on profiles —
// so a caller can only ever open a portal for THEIR own subscription.
//
// If the profile has no stripe_customer_id (e.g. status was set manually
// via SQL, or a webhook dropped), we fall back to looking the customer
// up by the verified email in Stripe and cache it back to the profile,
// so the user never has to manually "Refresh status" first.
//
// Required env vars:
//   SUPABASE_SERVICE_ROLE_KEY   bypasses RLS to read the profile row
//   STRIPE_SECRET_KEY           creates the portal session
//
// Response:
//   { ok: true, url }                    redirect the user here
//   { ok: false, error, message? }       human-readable explanation

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'
const RETURN_URL = 'https://dealflownow.net/settings'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method-not-allowed' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!serviceKey || !stripeSecret) {
    console.error('[customer-portal] missing SUPABASE_SERVICE_ROLE_KEY or STRIPE_SECRET_KEY')
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
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'token-missing-id' })
    }
  } catch (e) {
    console.error('[customer-portal] token check failed', e)
    return res.status(500).json({ ok: false, error: 'auth-check-failed' })
  }

  // ── Look up stripe_customer_id from the profile ──
  let stripeCustomerId
  try {
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    if (!profRes.ok) {
      const detail = await profRes.text().catch(() => '')
      console.error('[customer-portal] profile lookup failed', profRes.status, detail)
      return res.status(502).json({ ok: false, error: 'profile-lookup-failed' })
    }
    const rows = await profRes.json()
    stripeCustomerId = rows?.[0]?.stripe_customer_id
  } catch (e) {
    console.error('[customer-portal] profile lookup exception', e)
    return res.status(502).json({ ok: false, error: 'profile-lookup-failed' })
  }

  // ── Fallback: resolve customer by email if the profile has no ID ──
  // Self-heals the common case where Pro was granted via manual SQL or
  // a webhook dropped, so the user doesn't have to "Refresh status"
  // first. We pick the most recently-created Stripe customer for this
  // email and cache the ID back to the profile.
  if (!stripeCustomerId && email) {
    try {
      const search = await stripeGet(
        `/customers?email=${encodeURIComponent(email)}&limit=10`,
        stripeSecret
      )
      const customers = search?.data || []
      if (customers.length > 0) {
        // Prefer a customer that actually has a subscription; otherwise
        // take the first. Stripe returns newest-first by default.
        let chosen = customers[0]
        for (const c of customers) {
          try {
            const subs = await stripeGet(
              `/customers/${c.id}/subscriptions?status=all&limit=1`,
              stripeSecret
            )
            if ((subs?.data || []).length > 0) { chosen = c; break }
          } catch { /* ignore, fall through to first */ }
        }
        stripeCustomerId = chosen.id

        // Best-effort cache back to the profile — non-fatal if it fails.
        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
            }
          )
        } catch (e) {
          console.error('[customer-portal] customer-id cache-back failed', e)
        }
        console.log('[customer-portal] resolved customer via email fallback', { userId, email, stripeCustomerId })
      }
    } catch (e) {
      console.error('[customer-portal] email fallback failed', e)
    }
  }

  if (!stripeCustomerId) {
    // Still nothing — the user genuinely has no Stripe customer (never
    // checked out, or paid under a different email).
    return res.status(400).json({
      ok: false,
      error: 'no-stripe-customer',
      message: 'We could not find a Stripe subscription linked to your email. If you paid with a different email, contact support@dealflownow.net.',
    })
  }

  // ── Create the portal session ──
  try {
    const params = new URLSearchParams({
      customer: stripeCustomerId,
      return_url: RETURN_URL,
    })
    const sessionRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    if (!sessionRes.ok) {
      const detail = await sessionRes.text().catch(() => '')
      console.error('[customer-portal] session creation failed', sessionRes.status, detail)
      // Most common cause: portal not yet configured in Stripe. Surface
      // the underlying error so it's actionable rather than mysterious.
      return res.status(502).json({
        ok: false,
        error: 'portal-session-failed',
        message: 'Stripe could not create a billing portal session. Make sure the Customer Portal is configured at Stripe Dashboard → Settings → Billing → Customer portal.',
      })
    }
    const session = await sessionRes.json()
    console.log('[customer-portal] session created', { userId, stripeCustomerId })
    return res.status(200).json({ ok: true, url: session.url })
  } catch (e) {
    console.error('[customer-portal] session creation exception', e)
    return res.status(500).json({ ok: false, error: 'session-creation-failed' })
  }
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
