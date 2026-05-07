// Vercel serverless function — fires a welcome email when a new user signs
// up. Called fire-and-forget from SignUp.jsx; never blocks the signup flow.
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY      — required
//   RESEND_FROM_EMAIL   — optional (default: 'DealFlow <noreply@mail.dealflownow.net>')
//
// We send from the mail.dealflownow.net subdomain because Namecheap's free
// DNS doesn't expose MX-record creation on the apex domain — the subdomain
// approach keeps Resend's verification simple while leaving the apex untouched.
//
// Always returns 200 — even on failure — so the caller never has to handle
// HTTP errors. Inspect the JSON body for { success, error } if needed.

const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'DealFlow <noreply@mail.dealflownow.net>'
const ADMIN_FROM = 'DealFlow Admin <noreply@mail.dealflownow.net>'
const ADMIN_TO   = 'jimmycc24@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ success: false, error: 'method-not-allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      error: 'Email service not configured (RESEND_API_KEY missing).',
    })
  }
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(200).json({ success: false, error: 'invalid-json' })
  }

  const { email, firstName /*, userId */ } = body || {}
  if (!email || typeof email !== 'string') {
    return res.status(200).json({ success: false, error: 'email required' })
  }

  const safeName = (firstName && String(firstName).trim()) || 'agent'
  const html = renderEmail(safeName)

  // Fire the user-facing welcome AND the admin notification in parallel.
  // Both calls return 200-ish results; we surface a combined success/error
  // shape but never fail the request itself — the caller (SignUp.jsx) is
  // already fire-and-forget.
  try {
    const userPromise = fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Welcome to DealFlow — Let's get your first deal set up",
        html,
      }),
    })

    // Admin notification — independent of the user email. If Resend hasn't
    // verified the from-domain yet, this gracefully fails inline and we
    // log it without surfacing to the user.
    const adminPromise = sendAdminSignupNotification(apiKey, {
      email,
      firstName: safeName,
      headers: req.headers,
    })

    const [userResp, adminResult] = await Promise.allSettled([userPromise, adminPromise])

    // Only the user-facing email's success affects the response status.
    if (userResp.status === 'rejected') {
      return res.status(200).json({
        success: false,
        error: userResp.reason?.message || 'send failed',
      })
    }
    const r = userResp.value
    if (!r.ok) {
      let detail = ''
      try { detail = JSON.stringify(await r.json()) } catch {}
      return res.status(200).json({
        success: false,
        error: `resend ${r.status}${detail ? ` ${detail}` : ''}`,
        adminNotified: adminResult.status === 'fulfilled' && adminResult.value === true,
      })
    }
    return res.status(200).json({
      success: true,
      adminNotified: adminResult.status === 'fulfilled' && adminResult.value === true,
    })
  } catch (e) {
    return res.status(200).json({
      success: false,
      error: e.message || String(e),
    })
  }
}

// ─────────────────────────── Email template ───────────────────────────
function renderEmail(firstName) {
  const name = escapeHtml(firstName)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#0c1e35;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;font-size:32px;color:#ffffff;font-weight:900;letter-spacing:-0.5px;">
        Deal<span style="color:#c9a84c;">Flow</span>
      </h1>
      <p style="margin:8px 0 0;color:#8a9ab5;font-size:14px;">Real estate transactions, simplified.</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h2 style="color:#0c1e35;font-size:22px;margin:0 0 12px;">Welcome, ${name}!</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">
        You're now set up and ready to manage your real estate transactions from one screen.
        Everything you need — deals, clients, commissions, leads, showings — is right here.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://dealflownow.net"
           style="background:#c9a84c;color:#0c1e35;padding:14px 36px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Open DealFlow &rarr;
        </a>
      </div>

      <!-- 3 Steps -->
      <div style="background:#f7f3ec;border-radius:8px;padding:24px;margin:24px 0;">
        <h3 style="color:#0c1e35;font-size:14px;font-weight:700;margin:0 0 16px;
                   text-transform:uppercase;letter-spacing:0.1em;">Get started in 3 steps</h3>

        <div style="display:flex;align-items:flex-start;margin-bottom:16px;">
          <div style="background:#0c1e35;color:#c9a84c;font-weight:700;font-size:13px;
                      min-width:28px;height:28px;border-radius:50%;display:flex;
                      align-items:center;justify-content:center;margin-right:12px;
                      flex-shrink:0;text-align:center;line-height:28px;">1</div>
          <div>
            <strong style="color:#0c1e35;font-size:14px;">Add your first deal</strong>
            <p style="color:#718096;font-size:13px;margin:2px 0 0;line-height:1.5;">
              Tap the gold + button and enter your active transaction. Takes about 2 minutes.
            </p>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;margin-bottom:16px;">
          <div style="background:#0c1e35;color:#c9a84c;font-weight:700;font-size:13px;
                      min-width:28px;height:28px;border-radius:50%;display:flex;
                      align-items:center;justify-content:center;margin-right:12px;
                      flex-shrink:0;text-align:center;line-height:28px;">2</div>
          <div>
            <strong style="color:#0c1e35;font-size:14px;">Build your agent network</strong>
            <p style="color:#718096;font-size:13px;margin:2px 0 0;line-height:1.5;">
              Add agents you work with so you can notify them automatically when you schedule showings.
            </p>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;">
          <div style="background:#0c1e35;color:#c9a84c;font-weight:700;font-size:13px;
                      min-width:28px;height:28px;border-radius:50%;display:flex;
                      align-items:center;justify-content:center;margin-right:12px;
                      flex-shrink:0;text-align:center;line-height:28px;">3</div>
          <div>
            <strong style="color:#0c1e35;font-size:14px;">Check your Intelligence</strong>
            <p style="color:#718096;font-size:13px;margin:2px 0 0;line-height:1.5;">
              Head to Intelligence for your commission tracker, pipeline projections, and live market data.
            </p>
          </div>
        </div>
      </div>

      <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:24px 0 0;">
        Questions? Just reply to this email. We typically respond within 24 hours.
      </p>
      <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:8px 0 0;">
        Welcome aboard.
      </p>
      <p style="color:#0c1e35;font-size:14px;font-weight:700;margin:8px 0 0;">
        The DealFlow Team
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0c1e35;padding:20px 40px;text-align:center;">
      <p style="color:#8a9ab5;font-size:12px;margin:0;">
        &copy; 2026 DealFlow &middot;
        <a href="https://dealflownow.net" style="color:#c9a84c;text-decoration:none;">dealflownow.net</a>
      </p>
    </div>

  </div>
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

// ─────────────────────────── Admin notification ───────────────────────────
// Vercel automatically populates these geo headers on every request to a
// serverless function — no third-party API needed, no rate limits, no key.
function pullGeo(headers = {}) {
  const get = (k) => headers[k] || headers[k.toLowerCase()] || ''
  let city = get('x-vercel-ip-city')
  try { city = city ? decodeURIComponent(city) : '' } catch {}
  return {
    city,
    region:  get('x-vercel-ip-country-region'),
    country: get('x-vercel-ip-country'),
    ip:      get('x-real-ip') || (get('x-forwarded-for') || '').split(',')[0].trim(),
  }
}

async function sendAdminSignupNotification(apiKey, { email, firstName, headers }) {
  try {
    const geo = pullGeo(headers)
    const locationParts = [geo.city, geo.region, geo.country].filter(Boolean)
    const location = locationParts.length ? locationParts.join(', ') : 'Unknown'
    const timestamp = new Date().toISOString()

    const html = renderAdminEmail({
      firstName: escapeHtml(firstName),
      email: escapeHtml(email),
      location: escapeHtml(location),
      ip: escapeHtml(geo.ip || 'Unknown'),
      timestamp,
    })

    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ADMIN_FROM,
        to: [ADMIN_TO],
        subject: `🎉 New DealFlow signup: ${firstName}`,
        html,
      }),
    })
    return resp.ok
  } catch {
    return false
  }
}

function renderAdminEmail({ firstName, email, location, ip, timestamp }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;">
    <div style="background:#0c1e35;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:700;">
        Deal<span style="color:#c9a84c;">Flow</span>
        <span style="color:#8a9ab5;font-size:13px;font-weight:400;margin-left:8px;">Admin Notification</span>
      </h1>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="color:#0c1e35;font-size:18px;margin:0 0 12px;">New signup: ${firstName}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#718096;width:120px;">Name</td><td style="padding:8px 0;color:#0c1e35;font-weight:600;">${firstName}</td></tr>
        <tr style="border-top:1px solid #e8e6e2;"><td style="padding:8px 0;color:#718096;">Email</td><td style="padding:8px 0;color:#0c1e35;font-weight:600;">${email}</td></tr>
        <tr style="border-top:1px solid #e8e6e2;"><td style="padding:8px 0;color:#718096;">Location</td><td style="padding:8px 0;color:#0c1e35;">${location}</td></tr>
        <tr style="border-top:1px solid #e8e6e2;"><td style="padding:8px 0;color:#718096;">IP</td><td style="padding:8px 0;color:#0c1e35;font-family:monospace;font-size:12px;">${ip}</td></tr>
        <tr style="border-top:1px solid #e8e6e2;"><td style="padding:8px 0;color:#718096;">Time</td><td style="padding:8px 0;color:#0c1e35;font-family:monospace;font-size:12px;">${timestamp}</td></tr>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="https://dealflownow.net/admin"
           style="background:#c9a84c;color:#0c1e35;padding:10px 24px;border-radius:6px;
                  text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          Open Admin Dashboard
        </a>
      </div>
    </div>
  </div>
</body>
</html>`
}
