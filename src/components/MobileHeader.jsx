import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BellIcon, MenuIcon, HelpIcon } from './Icon'
import { useMobileDrawer } from '../context/MobileDrawerContext'

// Standard mobile navy header used at the top of pages on small screens.
// Hidden on md+ where the sidebar takes over.
//
// By default the left slot shows a hamburger that opens the drawer.
// Pass `showBack` to swap the hamburger for a back button.
// Pass a custom `leftSlot` to override entirely.

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
  const { setOpen } = useMobileDrawer()
  const isNavy = variant === 'navy'

  let resolvedLeft
  if (leftSlot) {
    resolvedLeft = leftSlot
  } else if (showBack) {
    resolvedLeft = (
      <button
        onClick={() => navigate(-1)}
        className={`-ml-2 w-10 h-10 flex items-center justify-center rounded-full ${isNavy ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-navy/60 hover:text-navy hover:bg-navy/[0.06]'} transition-colors`}
        aria-label="Back"
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </button>
    )
  } else {
    resolvedLeft = (
      <button
        onClick={() => setOpen(true)}
        className={`-ml-2 w-10 h-10 flex items-center justify-center rounded-full ${isNavy ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-navy/70 hover:text-navy hover:bg-navy/[0.06]'} transition-colors`}
        aria-label="Open menu"
      >
        <MenuIcon className="w-5 h-5" />
      </button>
    )
  }

  return (
    <header
      className={`md:hidden sticky top-0 z-30 pt-safe ${
        isNavy ? 'bg-navy text-white' : 'bg-white text-navy border-b border-navy/[0.06]'
      }`}
    >
      <div className={`px-5 ${isNavy ? 'gold-grid-bg' : ''}`}>
        <div className="pt-3 pb-4">
          <div className="flex items-center justify-between min-h-[40px]">
            <div className="flex items-center gap-2">{resolvedLeft}</div>
            <div className="flex items-center gap-1">
              {showBell && (
                <button
                  aria-label="Notifications"
                  className={`w-10 h-10 flex items-center justify-center rounded-full ${isNavy ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-navy/60 hover:text-navy hover:bg-navy/[0.06]'} transition-colors`}
                >
                  <BellIcon className="w-5 h-5" />
                </button>
              )}
              <a
                href="mailto:support@dealflownow.net"
                aria-label="Help & support"
                className={`w-10 h-10 flex items-center justify-center rounded-full ${isNavy ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-navy/60 hover:text-navy hover:bg-navy/[0.06]'} transition-colors`}
              >
                <HelpIcon className="w-5 h-5" />
              </a>
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
