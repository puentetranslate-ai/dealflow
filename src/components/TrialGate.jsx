import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'
import {
  CORE_CHECKOUT_URL, PRO_CHECKOUT_URL,
  CORE_PRICE_LABEL,  PRO_PRICE_LABEL,
} from '../lib/upgradeLinks'
import { LogoutIcon, LockIcon, CheckIcon } from './Icon'

// Full-screen tier-selection wall shown when the 30-day app trial has
// expired (daysRemaining <= 0) AND the user hasn't subscribed yet.
// Wraps protected page content via AppLayout — when active, the user
// cannot reach any deal / lead / commission data until they pick a
// plan and complete Stripe checkout.
//
// Two tiers are shown by default: Core ($15/mo) and Pro ($20/mo).
// Pro+ and Intelligence aren't live in Stripe yet — when their
// Payment Link URLs are added to upgradeLinks.js, drop them into the
// cards array below and they'll render automatically.
//
// Subscription.isProOrHigher() returns true for both paid users AND
// trial-active users (since the SubscriptionContext overlays trial
// state on top of paid state), so this gate correctly lets through
// every case except "trial expired without payment".
//
// Sign-out remains available so the user isn't trapped if they're
// signed in to the wrong account.

const TIERS = [
  {
    id: 'core',
    name: 'Core',
    price: CORE_PRICE_LABEL,
    href: CORE_CHECKOUT_URL,
    features: [
      'Full transaction management',
      'Deals, leads, clients, calendar',
      'Commission tracking + reports',
    ],
    cta: 'Subscribe to Core',
    ctaClass: 'btn-outline',
    cardClass: 'border-navy/[0.08]',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: PRO_PRICE_LABEL,
    href: PRO_CHECKOUT_URL,
    badge: 'Recommended',
    features: [
      'Everything in Core',
      'Client Portal — buyer + seller logins',
      'Multiple portals per deal',
    ],
    cta: 'Subscribe to Pro',
    ctaClass: 'btn-primary',
    cardClass: 'border-gold border-2',
  },
]

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
      <div className="max-w-3xl w-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-navy text-gold flex items-center justify-center mx-auto">
            <LockIcon className="w-7 h-7" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark mt-5">
            Trial Ended
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mt-2 leading-tight">
            Choose your plan
          </h1>
          <p className="text-muted text-sm md:text-base mt-3 leading-relaxed max-w-md mx-auto">
            Your free trial has ended. Pick a plan to keep your deals, leads, and clients accessible. Your data stays safe either way.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl border p-6 relative ${tier.cardClass}`}
            >
              {tier.badge && (
                <span className="absolute -top-3 right-4 bg-gold text-navy text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              )}
              <h3 className="font-display text-2xl font-bold text-navy">
                {tier.name}
              </h3>
              <p className="text-3xl font-bold text-navy mt-3 leading-none">
                {tier.price}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-navy/85">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-gold/15 text-gold-dark flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="w-3 h-3" />
                    </span>
                    <span className="leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${tier.ctaClass} w-full mt-6`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-muted text-xs mt-5">
          Cancel anytime. No long-term commitment.
        </p>

        <div className="text-center mt-8">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-muted hover:text-red-500 text-xs font-semibold transition-colors"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
