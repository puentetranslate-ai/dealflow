import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'

// Friendly countdown shown while the user's 30-day app trial is winding
// down. Two visual tones based on urgency:
//   - days 6-9 → subtle (muted gold-tinted strip)
//   - days 1-5 → prominent (gold background, navy text)
// >9 days remaining renders nothing. 0 days is handled by TrialGate.
//
// Intentionally has no CTA — during the trial, every feature is
// unlocked (SubscriptionContext.isProOrHigher returns true while
// isTrialActive) and we deliberately don't pressure the user to
// enter a credit card. The trial-end TrialGate is where tier
// selection + payment collection happen.

export default function TrialBanner() {
  const { loading, daysRemaining } = useTrial()
  const subscription = useSubscription()
  // Paying customers don't need to see the trial countdown at all.
  // (Trial users themselves should see it even though isProOrHigher
  // is true for them — that's why we check isPaid() here, not
  // isProOrHigher().)
  if (subscription.isPaid()) return null
  if (loading || daysRemaining == null) return null
  if (daysRemaining > 9) return null
  if (daysRemaining <= 0) return null // gate handles this

  const prominent = daysRemaining <= 5
  const dayLabel = daysRemaining === 1 ? 'day' : 'days'

  return (
    <div
      className={`mb-4 rounded-2xl px-4 py-3 ${
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
        .{' '}
        <span className={`font-normal ${prominent ? 'text-navy/80' : 'text-navy/65'}`}>
          {prominent
            ? "You'll pick a plan when it ends — no rush yet."
            : 'Try every feature — no credit card needed today.'}
        </span>
      </p>
    </div>
  )
}
