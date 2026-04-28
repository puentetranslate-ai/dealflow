import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon, XIcon, HouseIcon, NetworkIcon, BarChartIcon } from './Icon'

// Full-screen first-login welcome. Self-gated by localStorage so it shows
// exactly once per device per user. Mount it once in Dashboard; pass the
// signed-in user's id and first-name. The component handles everything
// else (visibility, dismiss, navigation).

const STORAGE_KEY = (userId) => `dealflow_welcomed_${userId}`

export default function WelcomeModal({ userId, firstName }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // Decide whether to show on mount. Effect (not render-time read) so SSR-
  // safe and so we don't flash the modal before localStorage is checked.
  useEffect(() => {
    if (!userId) return
    try {
      const seen = localStorage.getItem(STORAGE_KEY(userId))
      if (!seen) setOpen(true)
    } catch {
      // localStorage unavailable (private browsing edge case) — skip silently.
    }
  }, [userId])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY(userId), 'true') } catch {}
    setOpen(false)
  }

  const goTo = (path) => {
    dismiss()
    navigate(path)
  }

  if (!open) return null

  const name = (firstName && firstName.trim()) || 'agent'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Backdrop with gold-grid texture */}
      <div className="absolute inset-0 bg-navy gold-grid-bg" />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-pop w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors z-10"
        >
          <XIcon className="w-5 h-5" />
        </button>

        <div className="p-7 md:p-9">
          {/* Logo */}
          <div className="text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-navy">
              Deal<span className="text-gold">Flow</span>
            </h1>
          </div>

          {/* Greeting */}
          <h2
            id="welcome-title"
            className="font-display text-2xl md:text-3xl font-bold text-navy text-center mt-5 leading-tight"
          >
            Welcome, {name}!
          </h2>
          <p className="text-muted text-sm text-center mt-2">
            You're all set. Here's how to hit the ground running.
          </p>

          {/* Gold divider */}
          <div className="mx-auto mt-5 h-px w-16 bg-gold" />

          {/* Quick actions */}
          <div className="mt-6 space-y-3">
            <ActionCard
              icon={<HouseIcon className="w-5 h-5" />}
              title="Add your first deal"
              description="Tap the + button to enter your first active transaction"
              onClick={() => goTo('/deals/new')}
            />
            <ActionCard
              icon={<NetworkIcon className="w-5 h-5" />}
              title="Build your agent network"
              description="Add agents you work with to notify them about showings"
              onClick={() => goTo('/agent-network')}
            />
            <ActionCard
              icon={<BarChartIcon className="w-5 h-5" />}
              title="Explore your dashboard"
              description="See your deals, commissions, and market data at a glance"
              onClick={dismiss}
              variant="light"
            />
          </div>

          {/* Primary CTA */}
          <button
            onClick={dismiss}
            className="btn-primary w-full mt-6"
          >
            Let's Go
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </button>

          {/* Skip */}
          <button
            onClick={dismiss}
            className="block mx-auto mt-3 text-xs text-muted hover:text-navy transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionCard({ icon, title, description, onClick, variant = 'dark' }) {
  const bg = variant === 'light' ? 'bg-navy-light' : 'bg-navy'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full ${bg} text-white text-left rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:scale-[1.02] hover:shadow-pop transition-all duration-200 group`}
    >
      <span className="w-10 h-10 rounded-xl bg-white/[0.08] text-gold flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white">{title}</p>
        <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRightIcon className="w-4 h-4 text-gold shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
