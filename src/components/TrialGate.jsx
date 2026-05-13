import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'
import { PRO_CHECKOUT_URL, PRO_PRICE_LABEL } from '../lib/upgradeLinks'
import { ArrowRightIcon, LogoutIcon, LockIcon } from './Icon'

// Full-screen lock shown when the trial has expired (daysRemaining <= 0).
// Wraps protected page content via AppLayout — when active, the user
// cannot reach any deal / lead / commission data until they activate.
//
// Sign-out remains available so the agent isn't trapped if the wrong
// account is signed in.
//
// Paid subscribers (Pro+) bypass this gate entirely, even if their
// trial clock ran out — what matters for paid users is the
// subscription state, not the trial countdown.

export default function TrialGate({ children }) {
  const { loading, isExpired } = useTrial()
  const subscription = useSubscription()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  if (subscription.isProOrHigher()) return children
  if (loading || !isExpired) return children

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-navy text-gold flex items-center justify-center mx-auto">
          <LockIcon className="w-7 h-7" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark mt-5">
          Trial expired
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mt-2 leading-tight">
          Your free trial has ended
        </h1>
        <p className="text-muted text-sm md:text-base mt-3 leading-relaxed">
          Activate your subscription to regain access to your deals, leads, calendar, and commission data. Your information is safe and waiting.
        </p>

        <a
          href={PRO_CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full mt-6"
        >
          Upgrade to Pro
          <ArrowRightIcon className="w-4 h-4 ml-2" />
        </a>
        <p className="text-muted text-xs mt-3">
          {PRO_PRICE_LABEL} · Cancel anytime
        </p>

        <button
          onClick={handleSignOut}
          className="mt-8 inline-flex items-center gap-2 text-muted hover:text-red-500 text-xs font-semibold transition-colors"
        >
          <LogoutIcon className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  )
}
