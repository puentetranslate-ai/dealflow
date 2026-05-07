// Centralized admin gate. Used by:
//   - App.jsx (route allows entry but Admin.jsx checks again on mount)
//   - Admin.jsx (redirects non-admins)
//   - Sidebar.jsx + HamburgerDrawer.jsx (conditional Admin nav link)
//   - api/admin-users.js (server-side gate before returning user data)
//
// Single source of truth so the email check matches everywhere.

export const ADMIN_EMAIL = 'jimmycc24@gmail.com'

export function isAdmin(user) {
  return Boolean(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL)
}

// Subscription status helpers — single source of truth for derived state
// shared by Admin table, TrialContext (banner / modal / gate / Settings).
export const TRIAL_LENGTH_DAYS = 30

// Whole days that have elapsed since the trial started. floor() because
// "day 0" lasts the entire first 24 hours — only after a full day passes
// does the counter tick to 1.
function daysSinceTrialStart(trial_started_at) {
  const ms = Date.now() - new Date(trial_started_at).getTime()
  return Math.floor(ms / 86400000)
}

// Whole days remaining in the 30-day trial window. Clamped at 0 so an
// expired trial never shows a negative number.
//
// Examples (TRIAL_LENGTH_DAYS = 30):
//   started just now      → 30
//   started 1 day ago     → 29
//   started 9 days ago    → 21
//   started 16 days ago   → 14
//   started 30+ days ago  →  0
export function trialDaysRemaining(trial_started_at) {
  if (!trial_started_at) return TRIAL_LENGTH_DAYS
  return Math.max(0, TRIAL_LENGTH_DAYS - daysSinceTrialStart(trial_started_at))
}

export function computeUserStatus({ subscription_status, trial_started_at }) {
  if (subscription_status === 'active')    return 'Paying'
  if (subscription_status === 'cancelled') return 'Cancelled'

  // No trial start recorded — treat as a fresh trial
  if (!trial_started_at) return 'Trial Active'

  const remaining = trialDaysRemaining(trial_started_at)
  if (remaining <= 0) return 'Trial Expired'
  if (remaining <= 5) return 'Trial Expiring'
  return 'Trial Active'
}
