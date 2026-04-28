// Compact colored pill used inside Calendar day cells.
// Color is keyed off the event type via EVENT_STYLES.

export const EVENT_STYLES = {
  closing:        { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Closing' },
  offer:          { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Offer' },
  checklist:      { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Checklist' },
  overdue:        { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Overdue' },
  'lead-followup':{ bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Follow-up' },
  'client-task':  { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Task' },
}

export default function EventPill({ event, onClick, compact = false }) {
  const s = EVENT_STYLES[event.type] || EVENT_STYLES.checklist
  return (
    <button
      type="button"
      onClick={onClick}
      title={event.title}
      className={`w-full text-left rounded-md ${s.bg} ${s.text} ${
        compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2 py-1 text-xs leading-snug'
      } truncate hover:brightness-95 transition-all flex items-center gap-1.5`}
    >
      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className="truncate font-semibold">{event.title}</span>
    </button>
  )
}

// Compact dot variant — used on mobile day cells to indicate "events here"
// without taking up vertical space.
export function EventDot({ type }) {
  const s = EVENT_STYLES[type] || EVENT_STYLES.checklist
  return <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
}
