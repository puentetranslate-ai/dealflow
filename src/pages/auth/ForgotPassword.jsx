import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import AuthShell from '../../components/AuthShell'
import { MailIcon, ArrowLeftIcon } from '../../components/Icon'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await resetPassword(email)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-3xl p-7 md:p-9 shadow-pop">
        {sent ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailIcon className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-navy mb-2">Check your inbox</h2>
            <p className="text-muted text-sm">
              A password reset link was sent to <strong className="text-navy">{email}</strong>.
            </p>
            <Link to="/login" className="btn-navy mt-6 inline-flex">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-3xl font-bold text-navy">Reset password</h2>
            <p className="text-muted text-sm mt-1.5">Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-5 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <MailIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-with-icon"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-navy w-full">
                {loading ? <LoadingSpinner size="sm" light /> : 'Send Reset Link'}
              </button>
            </form>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-muted hover:text-navy text-sm mt-5 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to login
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}
