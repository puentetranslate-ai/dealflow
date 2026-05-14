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

  let userId
  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${userToken}`, apikey: serviceKey },
    })
    if (!meRes.ok) {
      return res.status(401).json({ ok: false, error: 'invalid-token' })
    }
    const me = await meRes.json()
    userId = me?.id
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

  if (!stripeCustomerId) {
    // User doesn't have a Stripe customer linked yet — this can happen
    // if their subscription_status was set manually (e.g. via SQL) or
    // if a webhook dropped. Direct them at the self-heal flow.
    return res.status(400).json({
      ok: false,
      error: 'no-stripe-customer',
      message: 'No Stripe customer record is linked to your account yet. Click "Refresh status" first to sync from Stripe, then try again.',
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
