import { PHASE_STYLES } from '../lib/constants'

// Phase pill badge used across deal cards, deal detail, etc.
// Optional `daysIn` prop appends "Xd in phase" subtitle for the deal-detail header.

export default function PhaseBadge({ phase, size = 'sm', daysIn = null }) {
  const style = PHASE_STYLES[phase] || PHASE_STYLES['Offer Accepted']
  const padding = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${style.bg} ${style.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {phase}
      {daysIn !== null && (
        <span className="opacity-60 font-medium ml-1">· {daysIn}d</span>
      )}
    </span>
  )
}

// Compact "phase + days in phase" pair styled like the spec
export function PhaseBadgeStack({ phase, daysIn }) {
  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <PhaseBadge phase={phase} />
      {typeof daysIn === 'number' && (
        <span className="text-[10px] font-medium text-muted">
          {daysIn}d in phase
        </span>
      )}
    </div>
  )
}
