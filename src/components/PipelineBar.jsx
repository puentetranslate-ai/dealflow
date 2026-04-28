import { PHASES, PHASE_STYLES } from '../lib/constants'

// Horizontal pipeline bar with one segment per phase, sized by deal count.
// Phases with 0 deals still render a thin placeholder slot so the labels line up.
//
// Short labels for the spec: Offer / Insp. / Appr. / Title / CTC.
//
// If `onPhaseClick` is provided, the labels below the bar become buttons that
// pass the full phase name (e.g. "Inspection") back to the parent — useful for
// driving a phase filter on the Dashboard.

const SHORT_LABELS = {
  'Offer Accepted': 'Offer',
  'Inspection': 'Insp.',
  'Appraisal': 'Appr.',
  'Title': 'Title',
  'Clear to Close': 'CTC',
}

const SEGMENT_COLOR = {
  'Offer Accepted': 'bg-blue-500',
  'Inspection': 'bg-yellow-500',
  'Appraisal': 'bg-orange-500',
  'Title': 'bg-purple-500',
  'Clear to Close': 'bg-green-500',
}

export default function PipelineBar({ deals, onPhaseClick, activePhase = null }) {
  const activePhases = PHASES.filter((p) => p !== 'Closed')
  const counts = activePhases.map((phase) => ({
    phase,
    count: deals.filter((d) => d.phase === phase).length,
  }))
  const total = counts.reduce((s, p) => s + p.count, 0)
  const interactive = Boolean(onPhaseClick)

  return (
    <div>
      {/* Bar — visual distribution */}
      <div className="h-3 rounded-full overflow-hidden bg-navy/[0.06] flex gap-0.5">
        {counts.map(({ phase, count }) => {
          const pct = total === 0 ? 100 / activePhases.length : (count / total) * 100
          return (
            <div
              key={phase}
              className={`${SEGMENT_COLOR[phase]} ${count === 0 ? 'opacity-20' : ''} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${phase}: ${count}`}
            />
          )
        })}
      </div>

      {/* Labels — interactive when onPhaseClick is provided */}
      <div className="grid grid-cols-5 gap-1 mt-2">
        {counts.map(({ phase, count }) => {
          const style = PHASE_STYLES[phase]
          const isActive = activePhase === phase

          if (!interactive) {
            return (
              <div key={phase} className="flex flex-col items-center text-center py-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="text-xs font-semibold text-navy">{SHORT_LABELS[phase]}</span>
                </div>
                <span className="text-xs text-muted mt-0.5">{count}</span>
              </div>
            )
          }

          return (
            <button
              key={phase}
              type="button"
              onClick={(e) => {
                // Don't trigger the surrounding pipeline-card click handler
                e.stopPropagation()
                onPhaseClick(phase)
              }}
              aria-pressed={isActive}
              className={`flex flex-col items-center text-center py-2 px-1 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-gold/15 ring-1 ring-gold/40'
                  : 'hover:bg-navy/[0.04] active:bg-navy/[0.08]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className={`text-xs font-semibold ${isActive ? 'text-navy' : 'text-navy'}`}>
                  {SHORT_LABELS[phase]}
                </span>
              </div>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-gold-dark font-bold' : 'text-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
