import { useQuickLog } from '../context/QuickLogContext'
import { BoltIcon } from './Icon'

// Two presentations of the same trigger:
//   - <QuickLogFab /> — secondary FAB stacked above the page's primary +FAB on mobile
//   - <QuickLogButton /> — desktop top-bar pill next to "+ New Deal"

export function QuickLogFab() {
  const { setOpen } = useQuickLog()
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Quick log"
      className="fixed right-4 z-40 w-14 h-14 bg-navy hover:bg-navy-light text-gold rounded-full shadow-pop flex items-center justify-center active:scale-95 transition-all md:hidden"
      style={{ bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 64px)' }}
    >
      <BoltIcon className="w-6 h-6" />
    </button>
  )
}

export function QuickLogButton() {
  const { setOpen } = useQuickLog()
  return (
    <button
      onClick={() => setOpen(true)}
      className="bg-navy/[0.04] hover:bg-navy/[0.08] text-navy font-semibold text-sm rounded-xl pl-3 pr-4 h-10 flex items-center gap-1.5 transition-colors"
    >
      <BoltIcon className="w-4 h-4 text-gold-dark" />
      Quick Log
    </button>
  )
}
