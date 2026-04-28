import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import AuthShell from '../../components/AuthShell'
import {
  MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, FingerprintIcon, CheckIcon,
} from '../../components/Icon'

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [stay, setStay] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-3xl p-7 md:p-9 shadow-pop">
        <h2 className="font-display text-3xl font-bold text-navy">Welcome back</h2>
        <p className="text-muted text-sm mt-1.5">Sign in to manage your pipeline.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Email */}
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

          {/* Password */}
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-with-icon pr-12"
                placeholder="••••••••"
                autoComplete="current-password"
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

          {/* Stay signed in / forgot */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setStay((v) => !v)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  stay ? 'bg-gold border-gold' : 'border-navy/20 bg-white'
                }`}
                aria-pressed={stay}
              >
                {stay && <CheckIcon className="w-3 h-3 text-navy" strokeWidth={3} />}
              </button>
              <span className="text-sm text-navy/80">Stay signed in</span>
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold text-gold hover:text-gold-dark transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Sign In */}
          <button type="submit" disabled={loading} className="btn-navy w-full mt-2 group">
            {loading ? (
              <LoadingSpinner size="sm" light />
            ) : (
              <>
                Sign In
                <ArrowRightIcon className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <span className="flex-1 h-px bg-navy/10" />
          <span className="text-xs font-semibold text-muted tracking-wider">OR</span>
          <span className="flex-1 h-px bg-navy/10" />
        </div>

        {/* Biometric */}
        <button
          type="button"
          onClick={() => alert('Biometric sign-in coming soon.')}
          className="btn-outline w-full"
        >
          <FingerprintIcon className="w-5 h-5 mr-2" />
          Use Fingerprint / Face ID
        </button>

        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-gold font-semibold hover:text-gold-dark transition-colors">
            Sign Up
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
