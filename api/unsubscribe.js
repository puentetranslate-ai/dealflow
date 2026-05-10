// Public unsubscribe endpoint — handles email-link clicks AND the
// RFC 8058 one-click POST that Gmail / Outlook / Yahoo Mail can issue
// directly from the inbox UI when an outbound email includes the
// matching List-Unsubscribe + List-Unsubscribe-Post headers.
//
// Three request shapes are supported:
//
//   GET  /api/unsubscribe?t=<token>
//     Renders a confirmation page with a single "Confirm unsubscribe"
//     button. Email clients that prefetch links (Apple Mail, some
//     corporate scanners) won't accidentally opt the recipient out —
//     they only see the confirmation page.
//
//   POST /api/unsubscribe?t=<token>
//     Body: any. Flips marketing_emails_unsubscribed_at to now() and
//     renders a "you're unsubscribed" page. Triggered by the form on
//     the confirmation page above.
//
//   POST /api/unsubscribe?t=<token>
//     Body: contains "List-Unsubscribe=One-Click" (form-encoded)
//     RFC 8058 spec. Mailbox providers send this when the user clicks
//     the native unsubscribe UI in Gmail / Outlook. We respond 200
//     with no body — providers don't render the response.
//
// The Settings page does NOT use this endpoint. Authenticated users
// flip the flag directly via supabase.from('profiles').update() since
// RLS already grants UPDATE on their own row.
//
// Required env vars:
//   BRIEFING_TOKEN              required, used as HMAC secret for tokens
//                               (reused so we don't proliferate secrets;
//                               rotating BRIEFING_TOKEN invalidates all
//                               outstanding unsubscribe links — users
//                               can still opt out via Settings or by
//                               replying with UNSUBSCRIBE).
//   SUPABASE_SERVICE_ROLE_KEY   required, used to flip the flag
//                               regardless of whether the recipient
//                               has an active session.

import { createHmac, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'

// Public helper — used by send-trial-followup.js to embed unsubscribe
// URLs in outbound emails. Kept as a named export so it can be imported
// without going through HTTP; the alternative would be duplicating the
// HMAC logic across the codebase.
export function buildUnsubscribeToken(userId, secret) {
  if (!userId || !secret) throw new Error('userId and secret required')
  const sig = createHmac('sha256', secret).update(String(userId)).digest('hex')
  return `${userId}.${sig}`
}

export function buildUnsubscribeUrl(userId, secret, origin = 'https://dealflownow.net') {
  const token = buildUnsubscribeToken(userId, secret)
  return `${origin}/api/unsubscribe?t=${encodeURIComponent(token)}`
}

export default async function handler(req, res) {
  const secret = process.env.BRIEFING_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !serviceKey) {
    console.error('[unsubscribe] missing BRIEFING_TOKEN or SUPABASE_SERVICE_ROLE_KEY')
    return sendHtml(res, 503, errorPage('Email preferences are temporarily unavailable. Please try again in a few minutes or reply to any DealFlow email with the word UNSUBSCRIBE.'))
  }

  // ─── Token verification ──────────────────────────────────────────
  const token = (req.query?.t || extractTokenFromUrl(req.url)) ?? ''
  const userId = verifyToken(token, secret)
  if (!userId) {
    return sendHtml(res, 400, errorPage('This unsubscribe link is invalid or has expired. To stop receiving DealFlow emails, reply to any email with the word UNSUBSCRIBE or update your preferences in Settings → Email preferences after signing in.'))
  }

  // ─── Detect RFC 8058 one-click POST ──────────────────────────────
  // Mailbox providers send `List-Unsubscribe=One-Click` in the body
  // (form-encoded) when the recipient clicks the native unsubscribe
  // chip. We honor it immediately and return 200 with no body — the
  // provider doesn't render a response page, it just trusts the 2xx.
  const isOneClick = await detectOneClickPost(req)

  if (req.method === 'GET') {
    // Show the confirmation page. No DB write yet.
    return sendHtml(res, 200, confirmPage(token))
  }

  if (req.method === 'POST') {
    // Either the confirmation form OR a one-click provider POST.
    const result = await unsubscribeUser(serviceKey, userId)
    if (!result.ok) {
      console.error('[unsubscribe] DB write failed', userId, result.error)
      // 5xx so mailbox providers know to retry the one-click. For the
      // human-confirmation path we still show a friendly error.
      if (isOneClick) return res.status(500).json({ error: 'update-failed' })
      return sendHtml(res, 500, errorPage("We couldn't update your preferences right now. Please try again in a moment, or reply UNSUBSCRIBE to any DealFlow email."))
    }
    if (isOneClick) {
      // Per RFC 8058 §3.1 — successful one-click returns 2xx, body ignored.
      return res.status(200).json({ ok: true })
    }
    return sendHtml(res, 200, successPage())
  }

  return sendHtml(res, 405, errorPage('Method not allowed.'))
}

// ─────────────────────────── Helpers ───────────────────────────
function extractTokenFromUrl(url) {
  if (!url) return null
  const q = url.split('?')[1]
  if (!q) return null
  for (const piece of q.split('&')) {
    const [k, v] = piece.split('=')
    if (k === 't' && v) {
      try { return decodeURIComponent(v) } catch { return v }
    }
  }
  return null
}

function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return null
  const userId = token.slice(0, lastDot)
  const provided = token.slice(lastDot + 1)
  // Basic shape check — UUIDs are 36 chars; reject anything wildly off.
  if (userId.length < 8 || provided.length < 16) return null
  const expected = createHmac('sha256', secret).update(userId).digest('hex')
  let a, b
  try {
    a = Buffer.from(expected, 'hex')
    b = Buffer.from(provided, 'hex')
  } catch { return null }
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}

async function detectOneClickPost(req) {
  // The header is what mailbox providers actually use to flag this.
  // The body check is a fallback for non-conforming senders.
  const ct = (req.headers['content-type'] || '').toLowerCase()
  if (!ct.includes('application/x-www-form-urlencoded')) return false
  let body = req.body
  if (typeof body === 'string') {
    return /(?:^|&)List-Unsubscribe=One-Click(?:&|$)/i.test(body)
  }
  if (body && typeof body === 'object') {
    return String(body['List-Unsubscribe'] || '').toLowerCase() === 'one-click'
  }
  // Body not parsed (rare on Vercel for x-www-form-urlencoded). Read raw.
  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return /(?:^|&)List-Unsubscribe=One-Click(?:&|$)/i.test(raw)
  } catch { return false }
}

async function unsubscribeUser(serviceKey, userId) {
  try {
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
        body: JSON.stringify({
          marketing_emails_unsubscribed_at: new Date().toISOString(),
        }),
      }
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return { ok: false, error: `${r.status} ${detail}` }
    }
    console.log('[unsubscribe] success', userId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

function sendHtml(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(body)
}

// ─────────────────────────── HTML pages ───────────────────────────
// Self-contained inline styles — no external CSS, no JS dependency.
// Matches the brand (navy + gold + cream) without pulling Tailwind.
const PAGE_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>DealFlow — Email preferences</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0; min-height: 100vh;
      background: #f7f3ec;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0c1e35;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      max-width: 480px; width: calc(100% - 32px);
      background: #fff; border-radius: 18px;
      padding: 40px 32px; margin: 24px;
      box-shadow: 0 4px 20px rgba(12, 30, 53, 0.06);
      text-align: center;
    }
    h1 {
      font-family: Georgia, 'Playfair Display', serif;
      font-size: 28px; margin: 0 0 12px;
      letter-spacing: -0.3px; font-weight: 800;
    }
    .brand { font-size: 14px; color: #8a9ab5; margin: 0 0 24px; letter-spacing: 0.06em; }
    .brand b { color: #c9a84c; font-weight: 700; }
    p { color: #4a5568; font-size: 15px; line-height: 1.65; margin: 0 0 16px; }
    .actions { margin-top: 28px; }
    button, .btn {
      display: inline-block; border: 0; cursor: pointer;
      font: inherit; font-weight: 600;
      padding: 12px 28px; border-radius: 10px;
      transition: background 0.15s ease;
      text-decoration: none;
    }
    button.primary, .btn.primary {
      background: #0c1e35; color: #fff;
    }
    button.primary:hover, .btn.primary:hover { background: #1a3456; }
    .btn.secondary {
      color: #8a9ab5; font-weight: 500;
      margin-top: 16px; display: inline-block;
    }
    .btn.secondary:hover { color: #0c1e35; }
    .small { font-size: 13px; color: #8a9ab5; }
  </style>
</head>
<body>
  <main class="card">
    <p class="brand">Deal<b>Flow</b></p>`
const PAGE_FOOT = `
  </main>
</body>
</html>`

function confirmPage(token) {
  const safeToken = String(token).replace(/[<>"&']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;', "'": '&#39;' }[c])
  )
  return `${PAGE_HEAD}
    <h1>Unsubscribe from DealFlow emails?</h1>
    <p>You'll stop receiving trial reminders, product updates, and marketing emails. Transactional account emails (password resets, deal notifications) will still be delivered.</p>
    <form method="POST" action="/api/unsubscribe?t=${safeToken}" class="actions">
      <button type="submit" class="primary">Confirm unsubscribe</button>
    </form>
    <a href="https://dealflownow.net" class="btn secondary">Never mind — take me back</a>
    ${PAGE_FOOT}`
}

function successPage() {
  return `${PAGE_HEAD}
    <h1>You're unsubscribed</h1>
    <p>We won't send you marketing or trial reminder emails from now on. If this was a mistake, you can resubscribe anytime from <strong>Settings → Email preferences</strong> in the app.</p>
    <a href="https://dealflownow.net" class="btn primary actions">Return to DealFlow</a>
    ${PAGE_FOOT}`
}

function errorPage(message) {
  const safe = String(message).replace(/[<>"&']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;', "'": '&#39;' }[c])
  )
  return `${PAGE_HEAD}
    <h1>Something went wrong</h1>
    <p>${safe}</p>
    <a href="https://dealflownow.net" class="btn primary actions">Return to DealFlow</a>
    ${PAGE_FOOT}`
}
