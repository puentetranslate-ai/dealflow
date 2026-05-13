import { useEffect, useState } from 'react'
import { useTrial } from '../context/TrialContext'
import { useSubscription } from '../context/SubscriptionContext'
import { XIcon } from './Icon'

// One-time heads-up shown the day before the trial ends. Shows once per
// session (sessionStorage gate). Intentionally has no upgrade CTA —
// tier selection happens at the trial-end TrialGate, not here. This
// modal exists purely so the trial-end screen isn't a surprise.
// Paying customers never see it.

export default function TrialModal() {
  const { loading, daysRemaining } = useTrial()
  const subscription = useSubscription()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (subscription.isPaid()) return
    if (loading) return
    if (daysRemaining !== 1) return
    if (sessionStorage.getItem('trial-1day-shown')) return
    setOpen(true)
    sessionStorage.setItem('trial-1day-shown', 'true')
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[85] flex items-end md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true">
      <div onClick={() => setOpen(false)} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-[460px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-7 max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-dark">Heads up</p>
            <h3 className="font-display text-xl font-bold text-navy mt-1 leading-tight">
              Your trial ends tomorrow
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
            Tomorrow you'll be asked to pick a plan to keep using DealFlow. No need to do anything today — just letting you know so it's not a surprise.
          </p>
          <p className="text-muted text-sm leading-relaxed mt-3">
            Your deals, leads, and clients stay safe either way.
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
