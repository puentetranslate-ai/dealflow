import { useEffect, useState } from 'react'
import { useTrial } from '../context/TrialContext'
import { XIcon, ArrowRightIcon } from './Icon'

const STRIPE_URL = 'https://buy.stripe.com/cNi14oetl2c75f19853F601'

// Single hard warning the day before the trial ends. Shows once per session
// (sessionStorage gate) so it's a real "huh, I should act on this" prompt
// rather than a constant nag.

export default function TrialModal() {
  const { loading, daysRemaining } = useTrial()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (daysRemaining !== 1) return
    if (sessionStorage.getItem('trial-1day-shown')) return
    setOpen(true)
    sessionStorage.setItem('trial-1day-shown', 'true')
  }, [loading, daysRemaining])

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
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-dark">Last day</p>
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
            Activate your subscription now to keep access to your deals, leads, calendar, and commission tracking. Takes about 30 seconds and you'll never lose data.
          </p>
          <a
            href={STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full mt-5"
          >
            Activate Subscription
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </a>
          <p className="text-center text-muted text-xs mt-3">
            $30 onboarding fee + $15/month after · Cancel anytime
          </p>
          <button
            onClick={() => setOpen(false)}
            className="block mx-auto mt-2 text-xs text-muted hover:text-navy transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
