// Vercel serverless function — sends individual emails to each agent in
// the user's selected network when a showing is scheduled.
//
// Uses Resend (https://resend.com) — pricing: 100/day free, 3000/month.
// One request per recipient (so an agent never sees other agents' emails)
// and so a single bad address doesn't poison the whole batch.
//
// Required env vars (set in Vercel project settings, NOT in client .env):
//   RESEND_API_KEY      — your Resend API key
//   RESEND_FROM_EMAIL   — optional, defaults to DealFlow <noreply@dealflownow.net>

const RESEND_URL = 'https://api.resend.com/emails'
const MAX_RECIPIENTS = 50
const DEFAULT_FROM = 'DealFlow <noreply@dealflownow.net>'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method-not-allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      success: false, sent: 0, failed: 0,
      error: 'Email service not configured. Add RESEND_API_KEY in Vercel.',
    })
  }
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'invalid-json' })
  }

  const {
    agentContacts,
    propertyAddress,
    showingDate,
    showingTime,
    clientName,
    agentName,
    agentPhone,
    agentEmail,
    notes,
  } = body || {}

  if (!Array.isArray(agentContacts) || agentContacts.length === 0) {
    return res.status(400).json({ error: 'agentContacts must be a non-empty array' })
  }
  if (agentContacts.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` })
  }
  if (!propertyAddress || !showingDate) {
    return res.status(400).json({ error: 'propertyAddress and showingDate are required' })
  }

  const subject = `Showing Scheduled — ${stripHtml(propertyAddress)}`
  const html = renderEmail({
    propertyAddress,
    showingDate,
    showingTime,
    clientName,
    agentName,
    agentPhone,
    agentEmail,
    notes,
  })

  // Send each email independently. Resend allows ~2 req/sec; a small parallel
  // burst is fine for typical agent network sizes (5-20). Failures are
  // counted, never thrown.
  const results = await Promise.allSettled(
    agentContacts.map((agent) =>
      sendOne({
        apiKey,
        from,
        to: agent.email,
        replyTo: agentEmail || undefined,
        subject,
        html,
      })
    )
  )

  let sent = 0
  let failed = 0
  const failedRecipients = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value?.ok) sent++
    else { failed++; failedRecipients.push(agentContacts[i].email) }
  })

  return res.status(200).json({
    success: failed === 0,
    sent,
    failed,
    total: agentContacts.length,
    ...(failed > 0 ? { failedRecipients } : {}),
  })
}

async function sendOne({ apiKey, from, to, replyTo, subject, html }) {
  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    return { ok: resp.ok, status: resp.status }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
}

// ─────────────────────────── Email template ───────────────────────────
function renderEmail({
  propertyAddress, showingDate, showingTime, clientName,
  agentName, agentPhone, agentEmail, notes,
}) {
  const dateLabel = formatDate(showingDate)
  const timeLabel = showingTime ? formatTime(showingTime) : 'Time TBD'

  return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0c1e35; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Deal<span style="color: #c9a84c;">Flow</span></h1>
    <p style="color: #8a9ab5; margin: 4px 0 0;">Showing Notification</p>
  </div>
  <h2 style="color: #0c1e35;">Showing Scheduled</h2>
  <p>A showing has been scheduled. Please inform your clients who may be interested.</p>
  <div style="background: #f7f3ec; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Property:</strong> ${escapeHtml(propertyAddress)}</p>
    <p><strong>Date:</strong> ${escapeHtml(dateLabel)}</p>
    <p><strong>Time:</strong> ${escapeHtml(timeLabel)}</p>
    ${clientName ? `<p><strong>Showing For:</strong> ${escapeHtml(clientName)}</p>` : ''}
    ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
  </div>
  <div style="border-top: 1px solid #e2d9c8; padding-top: 16px; margin-top: 20px;">
    ${agentName ? `<p><strong>Listing Agent:</strong> ${escapeHtml(agentName)}</p>` : ''}
    ${agentPhone ? `<p><strong>Phone:</strong> ${escapeHtml(agentPhone)}</p>` : ''}
    ${agentEmail ? `<p><strong>Email:</strong> ${escapeHtml(agentEmail)}</p>` : ''}
  </div>
  <p style="color: #8a9ab5; font-size: 12px; margin-top: 20px;">
    Sent via DealFlow · <a href="https://dealflownow.net">dealflownow.net</a>
  </p>
</body>
</html>`
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(s) {
  return escapeHtml(s).replace(/&[a-z#0-9]+;/gi, ' ').trim()
}

function formatDate(iso) {
  // iso is "YYYY-MM-DD". Append T00 so JS doesn't apply local-tz shifting.
  try {
    const d = new Date(`${iso}T00:00:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch { return iso || '' }
}

function formatTime(t) {
  // t is "HH:MM:SS" or "HH:MM"
  try {
    const [h, m] = t.split(':').map((x) => parseInt(x, 10))
    if (Number.isNaN(h) || Number.isNaN(m)) return t
    const d = new Date(2000, 0, 1, h, m)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return t || '' }
}
