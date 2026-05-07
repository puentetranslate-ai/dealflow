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
// shared by Admin table + (eventually) the trial banner / gate.
const TRIAL_LENGTH_DAYS = 30

export function computeUserStatus({ subscription_status, trial_started_at }) {
  if (subscription_status === 'active')    return 'Paying'
  if (subscription_status === 'cancelled') return 'Cancelled'

  if (!trial_started_at) {
    // No trial start recorded — treat as a fresh trial
    return 'Trial Active'
  }
  const elapsedDays = (Date.now() - new Date(trial_started_at).getTime()) / 86400000
  const remaining = Math.max(0, Math.ceil(TRIAL_LENGTH_DAYS - elapsedDays))
  if (remaining <= 0) return 'Trial Expired'
  if (remaining <= 5) return 'Trial Expiring'
  return 'Trial Active'
}

export function trialDaysRemaining(trial_started_at) {
  if (!trial_started_at) return TRIAL_LENGTH_DAYS
  const elapsed = (Date.now() - new Date(trial_started_at).getTime()) / 86400000
  return Math.max(0, Math.ceil(TRIAL_LENGTH_DAYS - elapsed))
}
