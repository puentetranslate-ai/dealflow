import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import AuthShell from '../../components/AuthShell'
import {
  MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, CheckIcon, UsersIcon,
} from '../../components/Icon'

export default function SignUp() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { data, error } = await signUp(email, password, fullName)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Fire-and-forget welcome email. Never blocks signup; failures are
      // swallowed silently so a Resend hiccup can't keep an agent stuck on
      // this screen.
      const firstName = (fullName || '').trim().split(/\s+/)[0] || ''
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          userId: data?.user?.id || null,
        }),
      }).catch(() => {})

      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell>
        <div className="bg-white rounded-3xl p-8 shadow-pop text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-green-600" strokeWidth={2.5} />
          </div>
          <h2 className="font-display text-2xl font-bold text-navy mb-2">Check your email</h2>
          <p className="text-muted text-sm">
            We sent a confirmation link to{' '}
            <strong className="text-navy">{email}</strong>. Click it to activate your account, then log in.
          </p>
          <Link to="/login" className="btn-navy mt-6 inline-flex">
            Go to Login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-3xl p-7 md:p-9 shadow-pop">
        <h2 className="font-display text-3xl font-bold text-navy">Create your account</h2>
        <p className="text-muted text-sm mt-1.5">Start tracking your pipeline in minutes.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="label">Full name</label>
            <div className="relative">
              <UsersIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-with-icon"
                placeholder="Jane Smith"
                autoComplete="name"
                required
              />
            </div>
          </div>

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
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button type="submit" disabled={loading} className="btn-navy w-full mt-2 group">
            {loading ? (
              <LoadingSpinner size="sm" light />
            ) : (
              <>
                Create Account
                <ArrowRightIcon className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <p className="text-center text-muted text-xs mt-3 leading-relaxed">
            By creating an account you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-dark hover:text-gold underline-offset-2 hover:underline transition-colors"
            >
              Terms of Service
            </a>.
          </p>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-gold font-semibold hover:text-gold-dark transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
