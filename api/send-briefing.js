// Vercel serverless function — sends the DealFlow Weekly Briefing email.
// Called by the Cowork-driven "dealflow-weekly-briefing" scheduled task every
// Friday at 6pm ET via a same-origin fetch from a Chrome tab navigated to
// dealflownow.net (Cowork's network sandbox can't reach Resend directly, so
// it routes through this endpoint instead).
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY     — required
//   BRIEFING_TOKEN     — required, shared secret verified via x-briefing-token header
//   RESEND_FROM_EMAIL  — optional (default: 'DealFlow Operations <noreply@mail.dealflownow.net>')
//
// Auth: requests must include header `x-briefing-token` matching BRIEFING_TOKEN.
// Without it the endpoint returns 401 — protects against random callers since
// /api/* on Vercel is publicly reachable by default.
//
// Request body (JSON):
//   { to, subject, html, text?, pdfUrl? }
//     - to:      string | string[]  recipient address(es)
//     - subject: string
//     - html:    string             full HTML email body
//     - text:    string (optional)  plain-text alternative — recommended for deliverability
//     - pdfUrl:  string (optional)  reserved for future attachment use; not currently embedded
//
// Response: { success: boolean, id?: string, error?: string }

const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'DealFlow Operations <noreply@mail.dealflownow.net>'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method-not-allowed' })
  }

  // ─── Auth ──────────────────────────────────────────────────────────
  const expectedToken = process.env.BRIEFING_TOKEN
  if (!expectedToken) {
    return res.status(500).json({
      success: false,
      error: 'BRIEFING_TOKEN not configured on server',
    })
  }
  const provided =
    req.headers['x-briefing-token'] || req.headers['X-Briefing-Token']
  if (provided !== expectedToken) {
    return res.status(401).json({ success: false, error: 'unauthorized' })
  }

  // ─── Resend config ─────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Email service not configured (RESEND_API_KEY missing).',
    })
  }
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  // ─── Body parsing & validation ────────────────────────────────────
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ success: false, error: 'invalid-json' })
  }

  const { to, subject, html, text } = body || {}
  if (!to || (typeof to !== 'string' && !Array.isArray(to))) {
    return res.status(400).json({
      success: false,
      error: 'to required (string or string[])',
    })
  }
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ success: false, error: 'subject required' })
  }
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ success: false, error: 'html required' })
  }

  const recipients = Array.isArray(to) ? to : [to]

  // ─── Send via Resend ───────────────────────────────────────────────
  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    })

    if (!resp.ok) {
      let detail = ''
      try {
        detail = JSON.stringify(await resp.json())
      } catch {}
      return res.status(502).json({
        success: false,
        error: `resend ${resp.status}${detail ? ` ${detail}` : ''}`,
      })
    }
    const data = await resp.json()
    return res.status(200).json({ success: true, id: data?.id })
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e) })
  }
}
