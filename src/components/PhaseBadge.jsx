import { PHASE_STYLES } from '../lib/constants'

export default function PhaseBadge({ phase, size = 'sm' }) {
  const style = PHASE_STYLES[phase] || PHASE_STYLES['Offer Accepted']
  const padding = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${style.bg} ${style.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {phase}
    </span>
  )
}
