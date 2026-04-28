import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BellIcon } from './Icon'

// Standard mobile navy header used at the top of pages on small screens.
// Hidden on md+ where the sidebar takes over.

export default function MobileHeader({
  title,
  eyebrow,
  showBack = false,
  showBell = false,
  rightSlot,
  leftSlot,
  children,
  variant = 'navy',
}) {
  const navigate = useNavigate()
  const isNavy = variant === 'navy'

  return (
    <header
      className={`md:hidden sticky top-0 z-30 pt-safe ${
        isNavy ? 'bg-navy text-white' : 'bg-white text-navy border-b border-navy/[0.06]'
      }`}
    >
      <div className={`px-5 ${isNavy ? 'gold-grid-bg' : ''}`}>
        <div className="pt-5 pb-4">
          <div className="flex items-center justify-between min-h-[36px]">
            <div className="flex items-center gap-2">
              {showBack ? (
                <button
                  onClick={() => navigate(-1)}
                  className={`-ml-2 p-2 ${isNavy ? 'text-white/70 hover:text-white' : 'text-navy/60 hover:text-navy'}`}
                  aria-label="Back"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
              ) : leftSlot}
            </div>
            <div className="flex items-center gap-1">
              {showBell && (
                <button
                  aria-label="Notifications"
                  className={`p-2 ${isNavy ? 'text-white/70 hover:text-white' : 'text-navy/60 hover:text-navy'}`}
                >
                  <BellIcon className="w-5 h-5" />
                </button>
              )}
              {rightSlot}
            </div>
          </div>

          {eyebrow && (
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] mt-2 ${isNavy ? 'text-gold' : 'text-muted'}`}>
              {eyebrow}
            </p>
          )}
          {title && (
            <h1 className={`font-display text-2xl font-bold leading-tight mt-1 ${isNavy ? 'text-white' : 'text-navy'}`}>
              {title}
            </h1>
          )}

          {children}
        </div>
      </div>
    </header>
  )
}
