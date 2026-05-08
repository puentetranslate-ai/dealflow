import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// Centralizes paid-tier gating. Reads `profiles.subscription_tier` and
// `profiles.subscription_status`, exposes a useSubscription() hook with
// boolean tier-checks so feature components don't have to reimplement
// the active-status logic.
//
// Tiers (DB column subscription_tier):
//   - 'beta'         (default for trial / current free users)
//   - 'pro'          (≥ Pro)
//   - 'pro_plus'     (≥ Pro+)
//   - 'intelligence' (≥ Intelligence)
//
// Status (DB column subscription_status):
//   - 'trial' | 'active' | 'cancelled' | 'expired'
//
// A tier flag like isProOrHigher() returns true ONLY if status === 'active'.
// A user whose subscription_tier was set to 'pro' but whose payment lapsed
// (status='cancelled' or 'expired') is treated as un-paid — they'll see
// the upgrade prompt again until they reactivate.

const TIER_RANK = {
  beta: 0,
  pro: 1,
  pro_plus: 2,
  intelligence: 3,
}

const SubscriptionContext = createContext(null)

const NEUTRAL_STATE = {
  loading: true,
  tier: null,
  status: null,
  isProOrHigher: () => false,
  isProPlusOrHigher: () => false,
  isIntelligence: () => false,
}

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(NEUTRAL_STATE)

  useEffect(() => {
    let cancelled = false

    if (!user) {
      // Logged-out callers see the neutral, locked-down state. Public
      // routes (landing, client portal token route) don't read this.
      setState({ ...NEUTRAL_STATE, loading: false })
      return
    }

    setState((s) => ({ ...s, loading: true }))

    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          // Profile row missing — treat as unpaid trial. Don't lock the
          // user out completely; they should see the upgrade prompt
          // (which is the same UX they'd get anyway).
          setState(buildState({ tier: 'beta', status: 'trial' }))
          return
        }
        setState(buildState({
          tier: data.subscription_tier || 'beta',
          status: data.subscription_status || 'trial',
        }))
      })

    return () => { cancelled = true }
  }, [user?.id])

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext) || NEUTRAL_STATE
}

// ─────────────────────────── Helpers ───────────────────────────
function buildState({ tier, status }) {
  const rank = TIER_RANK[tier] ?? 0
  // Active means the user's payment is current. Trial / cancelled /
  // expired all fall back to false even if the tier column was set —
  // we don't want to grant Pro features to someone whose card got
  // declined and is in grace period (they should re-upgrade or fix
  // the payment). The grace_period_ends_at flag is consulted by the
  // trial gate, not here.
  const active = status === 'active'

  return {
    loading: false,
    tier,
    status,
    isProOrHigher: () => active && rank >= TIER_RANK.pro,
    isProPlusOrHigher: () => active && rank >= TIER_RANK.pro_plus,
    isIntelligence: () => active && rank >= TIER_RANK.intelligence,
  }
}
