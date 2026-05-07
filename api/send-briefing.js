// Vercel serverless function — sends the DealFlow Weekly Briefing email.
// Called by the Cowork-driven "dealflow-weekly-briefing" scheduled task every
// Friday at 6pm ET via a same-origin fetch from a Chrome tab navigated to
// dealflownow.net (Cowork's network sandbox can't reach Resend directly, so
// it routes through this endpoint instead).
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY     — required
//   BRIEFING_TOKEN     — required, shared secret verified via x-briefing-token header
//                        Generate with: openssl rand -hex 32
//                        (or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
//                        Use 32+ random bytes — the auth check is timing-safe but
//                        a low-entropy token is still trivially brute-forceable.
//   RESEND_FROM_EMAIL  — optional (default: 'DealFlow Operations <noreply@mail.dealflownow.net>')
//
// Auth: requests must include header `x-briefing-token` matching BRIEFING_TOKEN.
// Without it the endpoint returns 401 — protects against random callers since
// /api/* on Vercel is publicly reachable by default.
//
// Request body (JSON):
//   { to, subject, html, text?, pdfUrl? }
//     - to:      string | string[]  recipient address(es). Capped at 50 per request.
//     - subject: string
//     - html:    string             full HTML email body
//     - text:    string (optional)  plain-text alternative — recommended for deliverability
//     - pdfUrl:  string (optional)  reserved for future attachment use; not currently embedded
//
// Response: { success: boolean, id?: string, error?: string }

import { timingSafeEqual } from 'node:crypto'

const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'DealFlow Operations <noreply@mail.dealflownow.net>'
const MAX_RECIPIENTS = 50
// Liberal email shape check — rejects obvious garbage without trying to
// reimplement RFC 5322. Resend handles the strict validation downstream.
const EMAIL_RE = /^\S+@\S+\.\S+$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method-not-allowed' })
  }

  // ─── Auth ──────────────────────────────────────────────────────────
  // BRIEFING_TOKEN missing on the server is an operator misconfiguration,
  // not a client error — but we MUST NOT leak that fact to unauthenticated
  // callers (lets attackers wait until you set the token to attack). Log
  // server-side, return a generic 503.
  const expectedToken = process.env.BRIEFING_TOKEN
  if (!expectedToken) {
    console.error('[send-briefing] BRIEFING_TOKEN env var not set')
    return res.status(503).json({ success: false, error: 'service-unavailable' })
  }

  // Node lowercases all header names — no need for a Title-Case fallback.
  const provided = req.headers['x-briefing-token']

  // Timing-safe comparison. Plain `!==` short-circuits byte-by-byte and
  // can leak the secret over enough samples — timingSafeEqual takes the
  // same time regardless of where the strings diverge.
  const ok = (() => {
    if (typeof provided !== 'string' || !provided) return false
    const a = Buffer.from(provided, 'utf8')
    const b = Buffer.from(expectedToken, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  })()
  if (!ok) {
    return res.status(401).json({ success: false, error: 'unauthorized' })
  }

  // ─── Resend config ─────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[send-briefing] RESEND_API_KEY env var not set')
    return res.status(503).json({ success: false, error: 'service-unavailable' })
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

  // Recipient count cap — defense-in-depth: even if the briefing token
  // leaks, an attacker can't blast thousands of addresses through your
  // Resend account in one call.
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    return res.status(400).json({
      success: false,
      error: `to[] must contain between 1 and ${MAX_RECIPIENTS} recipients`,
    })
  }

  // Format check — rejects obvious garbage before paying for an upstream
  // round-trip. Resend handles strict validation; this is just a sanity gate.
  const invalid = recipients.filter(
    (r) => typeof r !== 'string' || !EMAIL_RE.test(r)
  )
  if (invalid.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'one or more recipients are not valid email addresses',
    })
  }

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
      // Log full upstream detail server-side; return a generic error to
      // the caller so we don't echo third-party response bodies (which
      // could contain unexpected info now or in the future).
      let detail = ''
      try { detail = JSON.stringify(await resp.json()) } catch {}
      console.error('[send-briefing] Resend error', resp.status, detail)
      return res.status(502).json({
        success: false,
        error: `Email provider returned ${resp.status}`,
      })
    }

    const data = await resp.json()
    // Audit trail — id + recipient count + subject. Body is intentionally
    // omitted (size + potential PII).
    console.log('[send-briefing] sent', {
      id: data?.id,
      recipients: recipients.length,
      subject,
    })
    return res.status(200).json({ success: true, id: data?.id })
  } catch (e) {
    console.error('[send-briefing] send failed', e)
    return res.status(500).json({ success: false, error: 'send-failed' })
  }
}
