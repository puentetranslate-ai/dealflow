// Vercel serverless function — fires a welcome email when a new user signs
// up. Called fire-and-forget from SignUp.jsx; never blocks the signup flow.
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY — required
//
// From address is hardcoded to Resend's onboarding sandbox domain while
// dealflownow.net domain verification is in progress at Resend. NOTE:
// Resend's onboarding domain only delivers to the email registered on
// your Resend account; emails to other recipients return 403. Once the
// custom domain is verified, swap this back to a dealflownow.net sender.
//
// Always returns 200 — even on failure — so the caller never has to handle
// HTTP errors. Inspect the JSON body for { success, error } if needed.

const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'DealFlow <onboarding@resend.dev>'

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
  const from = FROM

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

  try {
    const resp = await fetch(RESEND_URL, {
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
    if (!resp.ok) {
      let detail = ''
      try { detail = JSON.stringify(await resp.json()) } catch {}
      return res.status(200).json({
        success: false,
        error: `resend ${resp.status}${detail ? ` ${detail}` : ''}`,
      })
    }
    return res.status(200).json({ success: true })
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
