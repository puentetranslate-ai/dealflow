// Tracks first-login onboarding completion via localStorage only.
// No DB columns, no Supabase touches — intentionally lightweight.
//
// The wizard is offered when:
//   - user has zero deals (fresh account, real first-time use), AND
//   - localStorage flag isn't set (they haven't completed/skipped it yet)
//
// As soon as the user creates their first deal, the dealsCount check
// flips false and the wizard never re-renders. Same effect if they
// dismiss/skip it manually.
//
// Failing open: if localStorage is unavailable (private browsing,
// disabled storage), we don't show the wizard. Better to skip the
// welcome flow than to nag forever on a user whose storage is locked.

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'df_onboarding_complete'

export function useOnboarding({ dealsCount = 0, loading = false } = {}) {
  const [dismissed, setDismissed] = useState(false)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'true') {
        setDismissed(true)
      }
    } catch {
      // Private mode / storage disabled — fail open so we never nag.
      setDismissed(true)
    }
    setStorageReady(true)
  }, [])

  const markComplete = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Ignored — the user's "done" intent still works for this session
      // via the React state, just won't persist across reloads.
    }
    setDismissed(true)
  }

  const showOnboarding =
    storageReady && !loading && dealsCount === 0 && !dismissed

  return {
    showOnboarding,
    completeOnboarding: markComplete,
    skipOnboarding: markComplete,
  }
}
