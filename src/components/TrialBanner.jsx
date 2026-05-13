import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'
import { PRO_CHECKOUT_URL } from '../lib/upgradeLinks'
import { ArrowRightIcon } from './Icon'

// Two visual tones based on urgency:
//   - days 6-9 → subtle (muted gold-tinted strip)
//   - days 1-5 → prominent (gold background, navy text)
// >9 days remaining renders nothing. 0 days is handled by TrialGate.
// Paid users (Pro+) see nothing regardless of trial state — the
// trial countdown is irrelevant once they've subscribed.

export default function TrialBanner() {
  const { loading, daysRemaining } = useTrial()
  const subscription = useSubscription()
  if (subscription.isProOrHigher()) return null
  if (loading || daysRemaining == null) return null
  if (daysRemaining > 9) return null
  if (daysRemaining <= 0) return null // gate handles this

  const prominent = daysRemaining <= 5
  const dayLabel = daysRemaining === 1 ? 'day' : 'days'

  return (
    <div
      className={`mb-4 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${
        prominent
          ? 'bg-gold text-navy shadow-card'
          : 'bg-gold/10 text-navy border border-gold/30'
      }`}
    >
      <p className="text-sm font-semibold">
        Your free trial ends in{' '}
        <span className={prominent ? 'text-navy' : 'text-gold-dark'}>
          {daysRemaining} {dayLabel}
        </span>
        . Add payment to keep access.
      </p>
      <a
        href={PRO_CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors ${
          prominent
            ? 'text-navy hover:text-navy-light'
            : 'text-gold-dark hover:text-gold'
        }`}
      >
        Upgrade to Pro
        <ArrowRightIcon className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
