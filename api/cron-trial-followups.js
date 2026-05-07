// Daily cron — finds trial users who hit day 7, 15, or 25 and sends them
// the matching nurture email. Configured in vercel.json under "crons".
//
// Vercel cron flow:
//   1. Vercel hits this endpoint with GET, including
//      `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in env.
//   2. We fetch all profiles where subscription_status='trial' and
//      trial_started_at is set.
//   3. For each, compute floor((now - trial_started_at)/86400000):
//        - 7  → send day-7 email if day7_sent_at is null
//        - 15 → send day-15 email if day15_sent_at is null
//        - 25 → send day-25 email if day25_sent_at is null
//   4. Each send is delegated to /api/send-trial-followup, which marks
//      the corresponding day{N}_sent_at column on success. So even if
//      the cron runs twice in a day, no user gets a duplicate.
//
// Why filter in JS rather than SQL? PostgREST doesn't support computed
// expressions like FLOOR((now() - col)/86400) in WHERE clauses without a
// dedicated view or RPC. For our scale (≤ a few thousand trial users)
// the round trip is fine.
//
// Required env vars:
//   CRON_SECRET                 required, validated against Authorization header
//   BRIEFING_TOKEN              required, forwarded to send-trial-followup
//   SUPABASE_SERVICE_ROLE_KEY   required, used to list trial profiles

import { timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'

// Days at which we fire emails. Keep in sync with renderTemplate() in
// send-trial-followup.js — both have to know about the same set.
const TRIGGER_DAYS = [7, 15, 25]

export default async function handler(req, res) {
  // Vercel cron always uses GET. Allow POST too for manual invocation.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method-not-allowed' })
  }

  // ─── Auth ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron-followups] CRON_SECRET env var not set')
    return res.status(503).json({ error: 'service-unavailable' })
  }
  const authHeader = req.headers.authorization || req.headers.Authorization || ''
  const expected = `Bearer ${cronSecret}`
  if (!constantTimeEq(authHeader, expected)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const briefingToken = process.env.BRIEFING_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!briefingToken || !serviceKey) {
    console.error('[cron-followups] missing BRIEFING_TOKEN or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(503).json({ error: 'service-unavailable' })
  }

  // ─── Fetch eligible profiles ──────────────────────────────────────
  // subscription_status='trial' and trial_started_at not null. We pull
  // just the columns we need to keep the payload small.
  let profiles
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,trial_started_at,day7_sent_at,day15_sent_at,day25_sent_at` +
      `&subscription_status=eq.trial&trial_started_at=not.is.null`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      console.error('[cron-followups] profiles fetch', r.status, detail)
      return res.status(502).json({ error: 'profiles-fetch-failed' })
    }
    profiles = await r.json()
  } catch (e) {
    console.error('[cron-followups] profiles fetch exception', e)
    return res.status(502).json({ error: 'profiles-fetch-failed' })
  }

  // ─── Dispatch ─────────────────────────────────────────────────────
  // Build the absolute URL for the sibling endpoint. VERCEL_URL is
  // automatically populated; in local/dev fall back to the request host.
  const host = process.env.VERCEL_URL || req.headers.host || ''
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const sendUrl = `${protocol}://${host}/api/send-trial-followup`

  const now = Date.now()
  const sent  = { day7: 0, day15: 0, day25: 0 }
  const skipped = { day7: 0, day15: 0, day25: 0 }
  const errors = []

  for (const p of profiles) {
    const startedMs = new Date(p.trial_started_at).getTime()
    if (!Number.isFinite(startedMs)) continue
    const day = Math.floor((now - startedMs) / 86400000)
    if (!TRIGGER_DAYS.includes(day)) continue

    const sentColumn =
      day === 7 ? p.day7_sent_at :
      day === 15 ? p.day15_sent_at :
      p.day25_sent_at
    if (sentColumn) {
      skipped[`day${day}`]++
      continue
    }

    try {
      const resp = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-briefing-token': briefingToken,
        },
        body: JSON.stringify({ day, userId: p.id }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok && data?.success) {
        sent[`day${day}`]++
      } else {
        errors.push({ userId: p.id, day, status: resp.status, error: data?.error })
        console.error('[cron-followups] send failed', p.id, day, resp.status, data?.error)
      }
    } catch (e) {
      errors.push({ userId: p.id, day, error: e.message })
      console.error('[cron-followups] send exception', p.id, day, e)
    }
  }

  const summary = {
    examined: profiles.length,
    sent,
    skipped,
    errors: errors.length,
  }
  console.log('[cron-followups] complete', summary)
  return res.status(200).json({ success: true, ...summary, errorDetails: errors })
}

// ─────────────────────────── Helpers ───────────────────────────
function constantTimeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
