import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// Centralizes trial-state computation so the banner, modal, gate, and the
// Settings → Subscription card can all share one source of truth.
//
// Reads `profiles.trial_started_at`. The trial is 30 days from that date.
// If the column doesn't exist yet (schema migration hasn't run), or if the
// user isn't logged in, returns a neutral state where everything is allowed.

const TRIAL_LENGTH_DAYS = 30
const TrialContext = createContext(null)

export function TrialProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    trialStartedAt: null,
    daysRemaining: null,
    isExpired: false,
  })

  useEffect(() => {
    let cancelled = false

    if (!user) {
      // Logged-out — provide neutral state. Public routes don't gate on trial.
      setState({ loading: false, trialStartedAt: null, daysRemaining: null, isExpired: false })
      return
    }

    setState((s) => ({ ...s, loading: true }))

    supabase
      .from('profiles')
      .select('trial_started_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.trial_started_at) {
          // Profile missing or migration not run — treat as fresh trial
          // starting now so the user isn't accidentally locked out.
          setState({
            loading: false,
            trialStartedAt: null,
            daysRemaining: TRIAL_LENGTH_DAYS,
            isExpired: false,
          })
          return
        }
        const startedAt = new Date(data.trial_started_at)
        const elapsed = (Date.now() - startedAt.getTime()) / 86400000
        const remaining = Math.max(0, Math.ceil(TRIAL_LENGTH_DAYS - elapsed))
        setState({
          loading: false,
          trialStartedAt: startedAt,
          daysRemaining: remaining,
          isExpired: remaining <= 0,
        })
      })

    return () => { cancelled = true }
  }, [user?.id])

  return (
    <TrialContext.Provider value={state}>
      {children}
    </TrialContext.Provider>
  )
}

export function useTrial() {
  return useContext(TrialContext) || {
    loading: true,
    trialStartedAt: null,
    daysRemaining: null,
    isExpired: false,
  }
}
