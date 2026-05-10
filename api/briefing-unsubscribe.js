// Weekly-briefing opt-out endpoint — same shape as api/unsubscribe.js
// but writes to a separate column (briefing_unsubscribed_at) so a
// recipient can opt out of the briefing without losing trial reminders,
// product news, or vice versa.
//
// All the heavy lifting (HMAC verification, DB writes, allowlisted
// column names) lives in api/unsubscribe.js and is imported here. Only
// the surface-level page text and the column name change.
//
// Required env vars:
//   BRIEFING_TOKEN              required, HMAC secret (shared with
//                               api/unsubscribe.js — tokens are
//                               cross-compatible at the signing
//                               layer but each endpoint writes to
//                               its own column).
//   SUPABASE_SERVICE_ROLE_KEY   required, used to update profiles.

import { verifyUnsubscribeToken, setUnsubscribedFlag } from './unsubscribe.js'

const COLUMN = 'briefing_unsubscribed_at'

export default async function handler(req, res) {
  const secret = process.env.BRIEFING_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !serviceKey) {
    console.error('[briefing-unsubscribe] missing BRIEFING_TOKEN or SUPABASE_SERVICE_ROLE_KEY')
    return sendHtml(res, 503, errorPage("Briefing preferences are temporarily unavailable. Please try again in a few minutes, or reply to the briefing email to opt out manually."))
  }

  const token = (req.query?.t || extractTokenFromUrl(req.url)) ?? ''
  const userId = verifyUnsubscribeToken(token, secret)
  if (!userId) {
    return sendHtml(res, 400, errorPage("This unsubscribe link is invalid or has expired. To stop receiving the weekly DealFlow briefing, reply to the briefing email with the word UNSUBSCRIBE."))
  }

  const isOneClick = await detectOneClickPost(req)

  if (req.method === 'GET') {
    return sendHtml(res, 200, confirmPage(token))
  }

  if (req.method === 'POST') {
    const result = await setUnsubscribedFlag(serviceKey, userId, COLUMN)
    if (!result.ok) {
      console.error('[briefing-unsubscribe] DB write failed', userId, result.error)
      if (isOneClick) return res.status(500).json({ error: 'update-failed' })
      return sendHtml(res, 500, errorPage("We couldn't update your preferences right now. Please try again in a moment."))
    }
    if (isOneClick) {
      return res.status(200).json({ ok: true })
    }
    return sendHtml(res, 200, successPage())
  }

  return sendHtml(res, 405, errorPage('Method not allowed.'))
}

// ─────────────────────────── Request parsing ───────────────────────────
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

async function detectOneClickPost(req) {
  const ct = (req.headers['content-type'] || '').toLowerCase()
  if (!ct.includes('application/x-www-form-urlencoded')) return false
  let body = req.body
  if (typeof body === 'string') {
    return /(?:^|&)List-Unsubscribe=One-Click(?:&|$)/i.test(body)
  }
  if (body && typeof body === 'object') {
    return String(body['List-Unsubscribe'] || '').toLowerCase() === 'one-click'
  }
  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return /(?:^|&)List-Unsubscribe=One-Click(?:&|$)/i.test(raw)
  } catch { return false }
}

function sendHtml(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(body)
}

// ─────────────────────────── HTML pages ───────────────────────────
const PAGE_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>DealFlow — Weekly briefing preferences</title>
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
    button.primary, .btn.primary { background: #0c1e35; color: #fff; }
    button.primary:hover, .btn.primary:hover { background: #1a3456; }
    .btn.secondary {
      color: #8a9ab5; font-weight: 500;
      margin-top: 16px; display: inline-block;
    }
    .btn.secondary:hover { color: #0c1e35; }
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
    <h1>Stop receiving the weekly briefing?</h1>
    <p>You'll no longer get the Friday DealFlow weekly briefing email. Other DealFlow emails (account notifications, trial reminders, deal alerts) are managed separately and won't be affected.</p>
    <form method="POST" action="/api/briefing-unsubscribe?t=${safeToken}" class="actions">
      <button type="submit" class="primary">Confirm unsubscribe</button>
    </form>
    <a href="https://dealflownow.net" class="btn secondary">Never mind — take me back</a>
    ${PAGE_FOOT}`
}

function successPage() {
  return `${PAGE_HEAD}
    <h1>You're off the briefing list</h1>
    <p>We won't send you the weekly DealFlow briefing from now on. If you change your mind, you can resubscribe anytime from <strong>Settings → Email preferences</strong> in the app.</p>
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
