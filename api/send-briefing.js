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
//   { to, subject, html, text?, pdfUrl?, unsubscribeUserId? }
//     - to:                 string | string[]  recipient address(es), capped at 50.
//     - subject:            string
//     - html:               string             full HTML email body
//     - text:               string (optional)  plain-text alternative — recommended.
//     - pdfUrl:             string (optional)  reserved for future attachment use.
//     - unsubscribeUserId:  string (optional)  Supabase auth.users.id (UUID) of the
//                                              briefing recipient. When provided:
//                                                * we mint an HMAC-signed
//                                                  /api/briefing-unsubscribe URL,
//                                                * substitute {{UNSUBSCRIBE_URL}}
//                                                  placeholders in html and text,
//                                                * add List-Unsubscribe and
//                                                  List-Unsubscribe-Post headers
//                                                  (RFC 8058 — Gmail / Outlook
//                                                  show a native unsubscribe chip
//                                                  next to the subject line),
//                                                * pre-check the profile's
//                                                  briefing_unsubscribed_at flag and
//                                                  200-skip if the user previously
//                                                  opted out.
//                                              Omit for unsubscribe-less sends.
//
// Response: { success: boolean, id?: string, skipped?: boolean, reason?: string, error?: string }

import { timingSafeEqual } from 'node:crypto'
import { buildUnsubscribeUrl } from './unsubscribe.js'

const RESEND_URL = 'https://api.resend.com/emails'
const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'
const PUBLIC_ORIGIN = 'https://dealflownow.net'
const DEFAULT_FROM = 'DealFlow Operations <noreply@mail.dealflownow.net>'
const MAX_RECIPIENTS = 50
// Liberal email shape check — rejects obvious garbage without trying to
// reimplement RFC 5322. Resend handles the strict validation downstream.
const EMAIL_RE = /^\S+@\S+\.\S+$/
// Placeholder string the caller can drop into html/text bodies. We
// substitute it server-side with the recipient-specific signed URL so
// the Cowork task doesn't need access to BRIEFING_TOKEN or any crypto
// to produce a working unsubscribe link.
const UNSUBSCRIBE_PLACEHOLDER = '{{UNSUBSCRIBE_URL}}'

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

  const { to, subject, html, text, unsubscribeUserId } = body || {}
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
  // unsubscribeUserId is optional but if provided must be a string —
  // anything else is a caller bug we'd rather catch than silently ignore.
  if (unsubscribeUserId != null && typeof unsubscribeUserId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'unsubscribeUserId must be a string (UUID) when provided',
    })
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

  // ─── Briefing-specific opt-out handling ───────────────────────────
  // If unsubscribeUserId was provided we:
  //   1. Look up briefing_unsubscribed_at on that profile (service-role).
  //      If non-null, the user opted out — return 200 with skipped=true.
  //   2. Mint a per-recipient signed unsubscribe URL.
  //   3. Substitute {{UNSUBSCRIBE_URL}} placeholders in both html/text.
  //   4. Attach List-Unsubscribe + List-Unsubscribe-Post headers so
  //      Gmail / Outlook show the native unsubscribe chip.
  //
  // None of this fires when unsubscribeUserId is absent — the endpoint
  // stays fully backward-compatible for callers that don't opt in.
  let finalHtml = html
  let finalText = text
  let resendHeaders = null
  let unsubscribeUrl = null

  if (unsubscribeUserId) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('[send-briefing] unsubscribeUserId provided but SUPABASE_SERVICE_ROLE_KEY missing')
      return res.status(503).json({ success: false, error: 'service-unavailable' })
    }
    // 1. Pre-send opt-out check.
    try {
      const lookup = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(unsubscribeUserId)}&select=briefing_unsubscribed_at`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      )
      if (lookup.ok) {
        const rows = await lookup.json()
        const flag = Array.isArray(rows) && rows[0]?.briefing_unsubscribed_at
        if (flag) {
          console.log('[send-briefing] skip — user unsubscribed', unsubscribeUserId)
          return res.status(200).json({
            success: true,
            skipped: true,
            reason: 'user-unsubscribed-from-briefing',
          })
        }
      } else {
        // Profile lookup failed but we still have a userId — log loudly
        // and proceed without the skip check. Letting the briefing go
        // through with a working unsubscribe link is preferable to
        // dropping the email entirely on a transient DB failure.
        const detail = await lookup.text().catch(() => '')
        console.error('[send-briefing] profile lookup failed; proceeding without skip-check', lookup.status, detail)
      }
    } catch (e) {
      console.error('[send-briefing] profile lookup exception; proceeding', e)
    }

    // 2 + 3. Mint the URL and substitute placeholders.
    unsubscribeUrl = buildUnsubscribeUrl(
      unsubscribeUserId,
      expectedToken,
      PUBLIC_ORIGIN,
      '/api/briefing-unsubscribe'
    )
    finalHtml = html.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl)
    if (typeof finalText === 'string') {
      finalText = finalText.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl)
    }

    // 4. RFC 8058 one-click headers for Gmail's native chip.
    resendHeaders = {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@dealflownow.net?subject=Unsubscribe%20from%20briefing>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
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
        html: finalHtml,
        ...(finalText ? { text: finalText } : {}),
        ...(resendHeaders ? { headers: resendHeaders } : {}),
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
      unsubscribeWired: Boolean(unsubscribeUrl),
    })
    return res.status(200).json({ success: true, id: data?.id })
  } catch (e) {
    console.error('[send-briefing] send failed', e)
    return res.status(500).json({ success: false, error: 'send-failed' })
  }
}
