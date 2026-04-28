import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import AuthShell from '../../components/AuthShell'
import { LockIcon, EyeIcon, EyeOffIcon, CheckIcon } from '../../components/Icon'

export default function ResetPassword() {
  const { user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('type=recovery') && !user) {
      navigate('/login', { replace: true })
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (newPw.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const { error } = await updatePassword(newPw)
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
    }
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-3xl p-7 md:p-9 shadow-pop">
        {done ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-7 h-7 text-green-600" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-2xl font-bold text-navy">Password updated</h2>
            <p className="text-muted text-sm mt-2">Redirecting you to your dashboard…</p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-3xl font-bold text-navy">Set new password</h2>
            <p className="text-muted text-sm mt-1.5">Choose a new password for your account.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-5 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="input-with-icon pr-12"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-navy transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="input-with-icon"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-navy w-full">
                {saving ? <LoadingSpinner size="sm" light /> : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  )
}
