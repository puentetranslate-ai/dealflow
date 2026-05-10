// Sends one of three trial-nurture emails (day 7, 15, or 25) to a user.
//
// Called by:
//   - api/cron-trial-followups.js  (daily Vercel cron — the normal path)
//   - Admin testing                (curl or the Admin dashboard)
//
// Required env vars:
//   RESEND_API_KEY              required
//   BRIEFING_TOKEN              required, shared secret in `x-briefing-token`
//                               header (same scheme as send-briefing.js)
//   SUPABASE_SERVICE_ROLE_KEY   required, used to look up the user's email
//                               and full_name and to mark `day{N}_sent_at`
//   RESEND_FROM_EMAIL           optional, default 'DealFlow Operations …'
//
// Request body (JSON):
//   { day: 7 | 15 | 25, userId: <uuid> }
//
// Behavior:
//   - Looks up the user's email + first name via Supabase service role
//   - Sends the appropriate Resend template
//   - On success, sets `profiles.day{day}_sent_at = now()` so the cron
//     can never double-send (idempotent at the DB layer too)
//
// Response: { success, id?, error? }

import { timingSafeEqual } from 'node:crypto'

const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'DealFlow Operations <noreply@mail.dealflownow.net>'
const SUPABASE_URL = 'https://xmylqfkwigpgrkpfzvfq.supabase.co'
const STRIPE_LINK = 'https://buy.stripe.com/cNiaEYgBtaIDePBac93F602'

const VALID_DAYS = new Set([7, 15, 25])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method-not-allowed' })
  }

  // ─── Auth ──────────────────────────────────────────────────────────
  const expectedToken = process.env.BRIEFING_TOKEN
  if (!expectedToken) {
    console.error('[trial-followup] BRIEFING_TOKEN env var not set')
    return res.status(503).json({ success: false, error: 'service-unavailable' })
  }
  if (!tokenOk(req.headers['x-briefing-token'], expectedToken)) {
    return res.status(401).json({ success: false, error: 'unauthorized' })
  }

  // ─── Required env ──────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey || !serviceKey) {
    console.error('[trial-followup] missing RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(503).json({ success: false, error: 'service-unavailable' })
  }
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  // ─── Parse + validate body ────────────────────────────────────────
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ success: false, error: 'invalid-json' })
  }
  const { day, userId } = body || {}
  if (!VALID_DAYS.has(Number(day))) {
    return res.status(400).json({ success: false, error: 'day must be 7, 15, or 25' })
  }
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, error: 'userId required' })
  }

  // ─── Look up the user (auth.users for email, profiles for name) ───
  let email, firstName
  try {
    const [authRes, profileRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,subscription_status`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      }),
    ])
    if (!authRes.ok) {
      return res.status(404).json({ success: false, error: 'user-not-found' })
    }
    const authUser = await authRes.json()
    email = authUser?.email
    if (!email) {
      return res.status(404).json({ success: false, error: 'user-has-no-email' })
    }
    const profiles = await profileRes.json().catch(() => [])
    const profile = Array.isArray(profiles) ? profiles[0] : null

    // Don't email a user who already converted — defense in depth.
    // The cron filters this too, but a manual call could bypass.
    if (profile?.subscription_status === 'active') {
      return res.status(200).json({
        success: false,
        skipped: true,
        reason: 'user-already-active',
      })
    }

    firstName = firstNameFromMetadata(authUser, profile)
  } catch (e) {
    console.error('[trial-followup] user lookup failed', e)
    return res.status(500).json({ success: false, error: 'user-lookup-failed' })
  }

  // ─── Render the email ─────────────────────────────────────────────
  const dayNum = Number(day)
  const tpl = renderTemplate(dayNum, firstName)

  // ─── Send via Resend ──────────────────────────────────────────────
  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      }),
    })
    if (!resp.ok) {
      let detail = ''
      try { detail = JSON.stringify(await resp.json()) } catch {}
      console.error('[trial-followup] Resend error', resp.status, detail)
      return res.status(502).json({
        success: false,
        error: `Email provider returned ${resp.status}`,
      })
    }
    const data = await resp.json()

    // ─── Mark sent ────────────────────────────────────────────────
    // Best-effort — even if the DB write fails, the email already went out;
    // we just risk a single duplicate next run. Log loudly so we notice.
    const column = `day${dayNum}_sent_at`
    try {
      const patch = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ [column]: new Date().toISOString() }),
        }
      )
      if (!patch.ok) {
        const detail = await patch.text().catch(() => '')
        console.error(`[trial-followup] failed to set ${column}`, patch.status, detail)
      }
    } catch (e) {
      console.error(`[trial-followup] DB write failed for ${column}`, e)
    }

    console.log('[trial-followup] sent', { day: dayNum, userId, email, id: data?.id })
    return res.status(200).json({ success: true, id: data?.id, day: dayNum })
  } catch (e) {
    console.error('[trial-followup] send failed', e)
    return res.status(500).json({ success: false, error: 'send-failed' })
  }
}

// ─────────────────────────── Helpers ───────────────────────────
function tokenOk(provided, expected) {
  if (typeof provided !== 'string' || !provided) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function firstNameFromMetadata(authUser, profile) {
  const raw =
    profile?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.raw_user_meta_data?.full_name ||
    ''
  const first = String(raw).trim().split(/\s+/)[0]
  return first || 'agent'
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

// ─────────────────────────── Templates ───────────────────────────
function renderTemplate(day, firstName) {
  const name = escapeHtml(firstName)
  if (day === 7)  return renderDay7(name)
  if (day === 15) return renderDay15(name)
  if (day === 25) return renderDay25(name)
  throw new Error(`unknown day ${day}`)
}

// ── DAY 7 — "Quick check-in" ────────────────────────────────────
function renderDay7(name) {
  return {
    subject: "Quick check-in — how's DealFlow working for you?",
    text: `Hi ${name},

You've had a week with DealFlow now — how's it going?

A lot of agents miss a couple of features in their first week that really change their workflow. If you haven't tried these yet, they're worth a few minutes:

  • Quick Log — log a showing or call in seconds without opening the deal
  • Showing Scheduler — auto-notify the listing agent when you book a showing
  • Client Portal — a private milestone tracker you can share with your buyer or seller

If anything's been confusing, just reply to this email. I read every one and answer fast.

— Jimmy
DealFlow
https://dealflownow.net

---
DealFlow · 15238 E Pond Woods Dr · Tampa, FL 33618
You're receiving this because you started a DealFlow free trial.
To stop these emails, reply with UNSUBSCRIBE.
`,
    html: emailShell(`
      <h2 style="color:#0c1e35;font-family:Georgia,'Playfair Display',serif;font-size:24px;margin:0 0 16px;font-weight:700;letter-spacing:-0.3px;">
        Quick check-in
      </h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Hi ${name}, you've had a week with DealFlow now — how's it going?
      </p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">
        A lot of agents miss a couple of features in their first week that really change their workflow.
        If you haven't tried these yet, they're worth a few minutes:
      </p>

      <div style="background:#f7f3ec;border-radius:10px;padding:24px;margin:0 0 24px;">
        ${featureRow('Quick Log', 'Log a showing or call in seconds without opening the deal.')}
        ${featureRow('Showing Scheduler', 'Auto-notify the listing agent when you book a showing.')}
        ${featureRow('Client Portal', 'A private milestone tracker you can share with your buyer or seller.', true)}
      </div>

      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 8px;">
        If anything's been confusing, just reply to this email. I read every one and answer fast.
      </p>
      <p style="color:#0c1e35;font-size:14px;font-weight:700;margin:24px 0 0;">— Jimmy</p>
      <p style="color:#718096;font-size:13px;margin:2px 0 0;">DealFlow</p>
    `),
  }
}

// ── DAY 15 — "Halfway through" ──────────────────────────────────
function renderDay15(name) {
  return {
    subject: "You're halfway through your DealFlow trial — here's what successful agents do next",
    text: `Hi ${name},

Halfway through your trial. Here's what we see the agents who get the most out of DealFlow do next:

1. Build out their Agent Network. Add the listing agents and buyer's agents you regularly work with. When you schedule showings or send updates, DealFlow notifies them automatically — saves a ton of texting back and forth.

2. Use Intelligence weekly. The pipeline projection and commission tracker are designed for the kind of "where am I at?" check-ins agents do every Friday. Live FRED market data is in there too — handy for client conversations.

3. Move every client to a Portal. Agents who do this report fewer "any updates?" texts. The portal is private, password-free, and updates in real time.

We've also got Pro features rolling out soon — document storage, e-signatures, and team workspaces. Beta members get them at the locked-in beta price.

Want a 15-minute walkthrough to get the most out of your remaining time? Just reply and we'll find a slot.

— Jimmy
DealFlow
https://dealflownow.net

---
DealFlow · 15238 E Pond Woods Dr · Tampa, FL 33618
You're receiving this because you started a DealFlow free trial.
To stop these emails, reply with UNSUBSCRIBE.
`,
    html: emailShell(`
      <h2 style="color:#0c1e35;font-family:Georgia,'Playfair Display',serif;font-size:24px;margin:0 0 16px;font-weight:700;letter-spacing:-0.3px;">
        You're halfway through your trial
      </h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Hi ${name}, here's what we see the agents who get the most out of DealFlow do next:
      </p>

      <div style="margin:0 0 24px;">
        ${tipRow('1', 'Build out your Agent Network', "Add the listing agents and buyer's agents you regularly work with. When you schedule showings or send updates, DealFlow notifies them automatically — saves a ton of texting back and forth.")}
        ${tipRow('2', 'Use Intelligence weekly', 'The pipeline projection and commission tracker are designed for the kind of "where am I at?" check-in agents do every Friday. Live FRED market data is in there too — handy for client conversations.')}
        ${tipRow('3', 'Move every client to a Portal', 'Agents who do this report fewer "any updates?" texts. The portal is private, password-free, and updates in real time.', true)}
      </div>

      <div style="background:#f7f3ec;border-left:3px solid #c9a84c;padding:16px 20px;margin:0 0 24px;border-radius:6px;">
        <p style="color:#0c1e35;font-size:14px;line-height:1.6;margin:0;">
          <strong>Heads up:</strong> Pro features are rolling out soon — document storage,
          e-signatures, and team workspaces. Beta members get them at the locked-in beta price.
        </p>
      </div>

      <div style="text-align:center;margin:32px 0 8px;">
        <a href="mailto:jimmy@puente-translations.com?subject=DealFlow%20walkthrough%20request"
           style="background:#c9a84c;color:#0c1e35;padding:14px 32px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Schedule a 15-min walkthrough &rarr;
        </a>
      </div>
      <p style="color:#718096;font-size:13px;line-height:1.6;text-align:center;margin:0;">
        Or just reply to this email — I read every one.
      </p>

      <p style="color:#0c1e35;font-size:14px;font-weight:700;margin:32px 0 0;">— Jimmy</p>
      <p style="color:#718096;font-size:13px;margin:2px 0 0;">DealFlow</p>
    `),
  }
}

// ── DAY 25 — "5 days left" ──────────────────────────────────────
function renderDay25(name) {
  return {
    subject: '5 days left — lock in beta pricing now',
    text: `Hi ${name},

Your DealFlow trial ends in 5 days.

If it's been useful, here's the math: $30 one-time onboarding + $15/month. That's the beta price. When DealFlow officially launches, the price goes up — but beta members keep their pricing forever.

Activate your subscription:
${STRIPE_LINK}

If you're on the fence and have questions about how it'd fit your workflow long-term, just reply. Happy to talk through it.

— Jimmy
DealFlow
https://dealflownow.net

---
DealFlow · 15238 E Pond Woods Dr · Tampa, FL 33618
You're receiving this because you started a DealFlow free trial.
To stop these emails, reply with UNSUBSCRIBE.
`,
    html: emailShell(`
      <div style="text-align:center;margin:0 0 8px;">
        <span style="display:inline-block;background:#0c1e35;color:#c9a84c;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          5 days left
        </span>
      </div>
      <h2 style="color:#0c1e35;font-family:Georgia,'Playfair Display',serif;font-size:26px;margin:16px 0 16px;font-weight:700;letter-spacing:-0.3px;text-align:center;">
        Your trial ends in 5 days
      </h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;text-align:center;">
        Hi ${name} — if DealFlow's been useful, here's the math.
      </p>

      <div style="background:#f7f3ec;border:2px solid #c9a84c;border-radius:12px;padding:28px 24px;margin:0 0 24px;text-align:center;">
        <p style="color:#0c1e35;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">
          Beta pricing
        </p>
        <p style="color:#0c1e35;font-size:32px;font-weight:800;margin:0;line-height:1.2;letter-spacing:-0.5px;">
          $30 <span style="font-size:18px;font-weight:600;color:#718096;">onboarding</span>
        </p>
        <p style="color:#0c1e35;font-size:32px;font-weight:800;margin:8px 0 0;line-height:1.2;letter-spacing:-0.5px;">
          + $15<span style="font-size:18px;font-weight:600;color:#718096;">/month</span>
        </p>
        <p style="color:#718096;font-size:13px;line-height:1.6;margin:16px 0 0;">
          When DealFlow officially launches, the price goes up.<br/>
          Beta members keep their pricing forever.
        </p>
      </div>

      <div style="text-align:center;margin:32px 0;">
        <a href="${STRIPE_LINK}"
           style="background:#c9a84c;color:#0c1e35;padding:16px 40px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:16px;display:inline-block;
                  box-shadow:0 4px 12px rgba(201,168,76,0.25);">
          Activate Subscription &rarr;
        </a>
      </div>

      <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:24px 0 0;text-align:center;">
        On the fence? Just reply to this email — happy to talk through it.
      </p>

      <p style="color:#0c1e35;font-size:14px;font-weight:700;margin:32px 0 0;">— Jimmy</p>
      <p style="color:#718096;font-size:13px;margin:2px 0 0;">DealFlow</p>
    `),
  }
}

// ── Shared HTML chrome (matches send-welcome-email.js) ──────────
// Footer includes the CAN-SPAM § 5 essentials: (a) valid physical
// postal address, (b) sender identity, (c) opt-out instruction.
// We use a reply-based opt-out because we don't yet host a one-click
// unsubscribe endpoint — replying "UNSUBSCRIBE" gets the message into
// our Resend inbox where we can mark the address suppressed.
function emailShell(inner) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#0c1e35;padding:28px 40px;text-align:center;">
      <h1 style="margin:0;font-family:Georgia,'Playfair Display',serif;font-size:30px;color:#ffffff;font-weight:900;letter-spacing:-0.5px;">
        Deal<span style="color:#c9a84c;">Flow</span>
      </h1>
    </div>
    <div style="padding:40px;">
      ${inner}
    </div>
    <div style="background:#0c1e35;padding:24px 40px;text-align:center;">
      <p style="color:#8a9ab5;font-size:11px;line-height:1.7;margin:0;">
        DealFlow &middot;
        <a href="https://dealflownow.net" style="color:#c9a84c;text-decoration:none;">dealflownow.net</a>
        <br/>
        15238 E Pond Woods Dr &middot; Tampa, FL 33618
        <br/>
        <span style="opacity:0.75;">You're receiving this because you started a DealFlow free trial. To stop receiving these emails, reply with "UNSUBSCRIBE" and we'll remove you within 24 hours.</span>
      </p>
    </div>
  </div>
</body>
</html>`
}

function featureRow(title, desc, last = false) {
  return `<div style="${last ? '' : 'margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e8e6e2;'}">
    <strong style="color:#0c1e35;font-size:14px;display:block;margin-bottom:2px;">${title}</strong>
    <span style="color:#4a5568;font-size:13px;line-height:1.55;">${desc}</span>
  </div>`
}

function tipRow(num, title, desc, last = false) {
  return `<div style="display:flex;align-items:flex-start;${last ? '' : 'margin-bottom:18px;'}">
    <div style="background:#0c1e35;color:#c9a84c;font-weight:700;font-size:14px;
                min-width:30px;height:30px;border-radius:50%;display:inline-block;
                text-align:center;line-height:30px;margin-right:14px;flex-shrink:0;">${num}</div>
    <div style="flex:1;">
      <strong style="color:#0c1e35;font-size:14px;display:block;margin-bottom:2px;">${title}</strong>
      <span style="color:#4a5568;font-size:14px;line-height:1.6;">${desc}</span>
    </div>
  </div>`
}
