// Server-side admin user listing.
//
// Requires (in Vercel env vars):
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service-role key (bypasses RLS).
//                               Find at Settings → API → service_role.
//                               NEVER expose this to the client.
//
// Auth flow:
//   1. Caller passes their Supabase access token in the Authorization header.
//   2. We validate the token by calling /auth/v1/user with it.
//   3. If the resulting user's email is the admin email, we use the service
//      role to fetch all users + profiles. Otherwise we 403.
//
// The service role key is also what lets us list users from auth.users,
// which is otherwise inaccessible from any client.

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'
const ADMIN_EMAIL = 'jimmycc24@gmail.com'

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return res.status(200).json({
      error: 'Service role key not configured',
      hint: 'Add SUPABASE_SERVICE_ROLE_KEY in Vercel project settings → Environment Variables.',
    })
  }

  // ── Validate the caller's token ──
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const userToken = authHeader.slice('Bearer '.length)

  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'apikey': serviceKey,
      },
    })
    if (!meRes.ok) return res.status(401).json({ error: 'invalid-token' })
    const me = await meRes.json()
    if (!me?.email || me.email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'forbidden' })
    }
  } catch (e) {
    return res.status(500).json({ error: 'auth-check-failed', message: e.message })
  }

  // ── Routing on method ──
  if (req.method === 'GET') return listUsers(res, serviceKey)
  if (req.method === 'PATCH') return updateUser(req, res, serviceKey)
  return res.status(405).json({ error: 'method-not-allowed' })
}

async function listUsers(res, serviceKey) {
  try {
    // Page through auth.users via the admin endpoint. Default page size
    // works fine for our scale; raise per_page if/when we exceed 1000 users.
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      }
    )
    if (!usersRes.ok) {
      const detail = await usersRes.text().catch(() => '')
      return res.status(200).json({ error: `users ${usersRes.status}`, detail })
    }
    const usersJson = await usersRes.json()
    const authUsers = usersJson.users || []

    // Fetch all profile rows.
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      }
    )
    const profiles = await profilesRes.json()
    const profilesById = {}
    for (const p of (Array.isArray(profiles) ? profiles : [])) {
      profilesById[p.id] = p
    }

    // Merge — auth.users is the source of truth for email + sign-in dates;
    // profiles supplies name + trial + subscription_status.
    const merged = authUsers.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
      full_name: profilesById[u.id]?.full_name || '',
      trial_started_at: profilesById[u.id]?.trial_started_at || u.created_at || null,
      subscription_status: profilesById[u.id]?.subscription_status || 'trial',
      default_commission_pct: profilesById[u.id]?.default_commission_pct ?? null,
    }))

    return res.status(200).json({ users: merged })
  } catch (e) {
    return res.status(200).json({ error: e.message || 'fetch-failed' })
  }
}

async function updateUser(req, res, serviceKey) {
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'invalid-json' })
  }
  const { userId, subscription_status, trial_started_at } = body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  // Allow updating only the fields the admin UI needs to flip.
  const update = {}
  if (typeof subscription_status === 'string' &&
      ['trial', 'active', 'cancelled', 'expired'].includes(subscription_status)) {
    update.subscription_status = subscription_status
  }
  if (trial_started_at === null || typeof trial_started_at === 'string') {
    update.trial_started_at = trial_started_at
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'nothing-to-update' })
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(update),
      }
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return res.status(200).json({ error: `update ${r.status}`, detail })
    }
    const data = await r.json()
    return res.status(200).json({ ok: true, profile: Array.isArray(data) ? data[0] : data })
  } catch (e) {
    return res.status(200).json({ error: e.message || 'update-failed' })
  }
}
