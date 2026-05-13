import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useTrial } from './TrialContext'

// Centralizes paid-tier + trial-state gating. Reads
// `profiles.subscription_tier` and `profiles.subscription_status` from
// Supabase, combines them with the trial countdown from TrialContext,
// and exposes a useSubscription() hook with boolean tier-checks so
// feature components don't have to reimplement the access logic.
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
// Two separate semantic checks are exposed:
//
//   isProOrHigher() etc. — "does the user have access to this feature?"
//     Returns true if they've paid for the tier OR they're in their
//     30-day app trial (where everything is unlocked by design — no
//     credit card needed to try Pro features). After trial expires,
//     this falls back to the strict paid check.
//
//   isPaid() — "is this person paying us money?"
//     Returns true only when status === 'active' AND tier is Pro+.
//     Used by UI that needs to differentiate paying customers from
//     trial users (e.g. show "Manage Subscription" vs "Free Trial").
//     A user whose tier was set to 'pro' but whose payment lapsed
//     (status='cancelled'/'expired') is treated as un-paid.

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
  isTrialActive: false,
  isPaid: () => false,
  isProOrHigher: () => false,
  isProPlusOrHigher: () => false,
  isIntelligence: () => false,
}

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const trial = useTrial()
  const [profile, setProfile] = useState({ tier: null, status: null, loaded: false })

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setProfile({ tier: null, status: null, loaded: true })
      return
    }

    setProfile((p) => ({ ...p, loaded: false }))

    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          // Profile row missing — treat as a fresh trial. Don't lock the
          // user out; they should still get the in-trial experience.
          setProfile({ tier: 'beta', status: 'trial', loaded: true })
          return
        }
        setProfile({
          tier: data.subscription_tier || 'beta',
          status: data.subscription_status || 'trial',
          loaded: true,
        })
      })

    return () => { cancelled = true }
  }, [user?.id])

  // Build the state every render — cheap, and ensures helpers always
  // see the latest trial state (which updates as the day rolls over
  // without remounting the provider).
  const loading = !profile.loaded || trial.loading
  const isTrialActive = !trial.loading && (trial.daysRemaining ?? 0) > 0
  const state = loading
    ? { ...NEUTRAL_STATE, loading: true }
    : buildState({ tier: profile.tier, status: profile.status, isTrialActive })

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
function buildState({ tier, status, isTrialActive }) {
  const rank = TIER_RANK[tier] ?? 0
  const active = status === 'active'

  // isPaid is independent of trial — a trial user is NOT paying us yet.
  const paidPro          = active && rank >= TIER_RANK.pro
  const paidProPlus      = active && rank >= TIER_RANK.pro_plus
  const paidIntelligence = active && rank >= TIER_RANK.intelligence

  return {
    loading: false,
    tier,
    status,
    isTrialActive,
    isPaid: () => paidPro,
    // Tier-gated feature checks. Trial users get true on every tier
    // because the 30-day app trial unlocks everything — no card
    // required to try Pro/Pro+/Intelligence features. After trial
    // expires (isTrialActive=false), it falls back to the strict
    // paid check, so the user has to subscribe to keep access.
    isProOrHigher:      () => paidPro          || isTrialActive,
    isProPlusOrHigher:  () => paidProPlus      || isTrialActive,
    isIntelligence:     () => paidIntelligence || isTrialActive,
  }
}
