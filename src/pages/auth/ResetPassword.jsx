import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function ResetPassword() {
  const { user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  // If no recovery session, send to login
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
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-white">
            Deal<span className="text-gold">Flow</span>
          </h1>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-xl font-bold text-navy">Password updated!</h2>
              <p className="text-muted text-sm mt-2">Redirecting you to your dashboard…</p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-navy mb-2">Set new password</h2>
              <p className="text-muted text-sm mb-6">Choose a new password for your account.</p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="input-field"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="input-field"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button type="submit" disabled={saving} className="btn-navy">
                  {saving ? <LoadingSpinner size="sm" light /> : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
