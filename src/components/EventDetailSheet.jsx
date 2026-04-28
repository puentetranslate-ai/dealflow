import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { EVENT_STYLES } from './EventPill'
import { XIcon, ArrowRightIcon } from './Icon'

// Bottom sheet on mobile, centered modal on desktop.
// Tap-outside or X to close.

export default function EventDetailSheet({ event, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!event) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!event) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [event])

  const navigate = useNavigate()

  if (!event) return null

  const style = EVENT_STYLES[event.type] || EVENT_STYLES.checklist
  let dateLabel = '—'
  try {
    dateLabel = format(parseISO(event.date), 'EEEE, MMMM d, yyyy')
  } catch {}

  const ctaLabel = event.link?.includes('/leads/')
    ? 'View Lead'
    : event.link?.includes('/deals/')
    ? 'View Deal'
    : 'Open'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div onClick={onClose} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-auto md:min-w-[440px] max-w-md rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-6">
        <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`w-11 h-11 rounded-xl ${style.bg} ${style.text} flex items-center justify-center shrink-0`}>
              <span className={`w-3 h-3 rounded-full ${style.dot}`} />
            </span>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</p>
              <h3 className="font-display text-lg font-bold text-navy leading-tight mt-0.5">{event.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <dl className="space-y-3 mt-3 text-sm">
            <Row label="Date" value={dateLabel} />
            {event.subtitle && <Row label="Details" value={event.subtitle} />}
          </dl>

          {event.link && (
            <button
              onClick={() => { navigate(event.link); onClose() }}
              className="mt-5 w-full bg-navy hover:bg-navy-light text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors"
            >
              {ctaLabel}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted text-xs uppercase tracking-wider font-semibold">{label}</dt>
      <dd className="text-navy text-right">{value}</dd>
    </div>
  )
}
