import { PHASES, PHASE_STYLES } from '../lib/constants'

// Horizontal pipeline bar with one segment per phase, sized by deal count.
// Phases with 0 deals still render a thin placeholder slot so the labels line up.
//
// Short labels for the spec: Offer / Insp. / Appr. / Title / CTC.

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

export default function PipelineBar({ deals }) {
  const activePhases = PHASES.filter((p) => p !== 'Closed')
  const counts = activePhases.map((phase) => ({
    phase,
    count: deals.filter((d) => d.phase === phase).length,
  }))
  const total = counts.reduce((s, p) => s + p.count, 0)

  return (
    <div>
      {/* Bar */}
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

      {/* Labels */}
      <div className="grid grid-cols-5 gap-2 mt-3">
        {counts.map(({ phase, count }) => {
          const style = PHASE_STYLES[phase]
          return (
            <div key={phase} className="flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className="text-xs font-semibold text-navy">{SHORT_LABELS[phase]}</span>
              </div>
              <span className="text-xs text-muted mt-0.5">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
