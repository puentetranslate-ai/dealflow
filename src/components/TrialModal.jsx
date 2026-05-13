import { useEffect, useState } from 'react'
import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'
import { XIcon } from './Icon'

// Trial wind-down reminders. Fires twice during the 30-day app trial:
//   - 7 days remaining → "trial ends in a week"
//   - 1 day  remaining → "trial ends tomorrow"
// Each modal shows once per session (sessionStorage gate, separate key
// per reminder) so the user gets a real heads-up, not a constant nag.
// Paying customers and users with > 7 days remaining never see it.
//
// Intentionally has no upgrade CTA — the trial-end TrialGate is where
// tier selection + payment collection happen. These modals exist
// purely so the trial-end screen isn't a surprise.

const REMINDERS = {
  7: {
    eyebrow: 'One week left',
    title: 'Your trial ends in a week',
    body1: "In 7 days you'll be asked to pick a plan to keep using DealFlow. Start thinking about which tier fits your workflow — Core for transaction management, Pro if you want the Client Portal.",
    body2: 'Your deals, leads, and clients stay safe either way.',
    storageKey: 'trial-7day-shown',
  },
  1: {
    eyebrow: 'Heads up',
    title: 'Your trial ends tomorrow',
    body1: "Tomorrow you'll be asked to pick a plan to keep using DealFlow. No need to do anything today — just letting you know so it's not a surprise.",
    body2: 'Your deals, leads, and clients stay safe either way.',
    storageKey: 'trial-1day-shown',
  },
}

export default function TrialModal() {
  const { loading, daysRemaining } = useTrial()
  const subscription = useSubscription()
  const [open, setOpen] = useState(false)
  const [reminder, setReminder] = useState(null)

  useEffect(() => {
    if (subscription.isPaid()) return
    if (loading) return
    const r = REMINDERS[daysRemaining]
    if (!r) return
    if (sessionStorage.getItem(r.storageKey)) return
    setReminder(r)
    setOpen(true)
    sessionStorage.setItem(r.storageKey, 'true')
  }, [loading, daysRemaining, subscription])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !reminder) return null

  return (
    <div className="fixed inset-0 z-[85] flex items-end md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true">
      <div onClick={() => setOpen(false)} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-[460px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-7 max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-dark">{reminder.eyebrow}</p>
            <h3 className="font-display text-xl font-bold text-navy mt-1 leading-tight">
              {reminder.title}
            </h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pt-3 pb-6">
          <p className="text-muted text-sm leading-relaxed">
            {reminder.body1}
          </p>
          <p className="text-muted text-sm leading-relaxed mt-3">
            {reminder.body2}
          </p>
          <button
            onClick={() => setOpen(false)}
            className="btn-primary w-full mt-5"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
