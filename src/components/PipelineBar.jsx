import { PHASES, PHASE_STYLES } from '../lib/constants'

// Horizontal pipeline bar.
//
// With the expanded phase list (10 active phases), rendering every phase as
// a fixed segment makes labels unreadable. We now show only phases that
// actually have at least one deal. When the pipeline is empty the dashboard
// renders its own empty state above this — we still render a thin sliver so
// the card doesn't collapse.

const SHORT_LABELS = {
  'Listed': 'Listed',
  'Showing Period': 'Show.',
  'Offer Received': 'Offer Rcv',
  'Searching': 'Search',
  'Offer Made': 'Offer Made',
  'Offer Accepted': 'Offer Acc',
  'Inspection': 'Insp.',
  'Appraisal': 'Appr.',
  'Title': 'Title',
  'Clear to Close': 'CTC',
}

const SEGMENT_COLOR = {
  'Listed': 'bg-slate-500',
  'Showing Period': 'bg-indigo-500',
  'Offer Received': 'bg-sky-500',
  'Searching': 'bg-indigo-500',
  'Offer Made': 'bg-sky-500',
  'Offer Accepted': 'bg-blue-500',
  'Inspection': 'bg-yellow-500',
  'Appraisal': 'bg-orange-500',
  'Title': 'bg-purple-500',
  'Clear to Close': 'bg-green-500',
}

export default function PipelineBar({ deals, onPhaseClick, activePhase = null }) {
  // Order: any phase with deals, in canonical order. Closed is excluded.
  const all = PHASES.filter((p) => p !== 'Closed').map((phase) => ({
    phase,
    count: deals.filter((d) => d.phase === phase).length,
  }))
  const counts = all.filter((p) => p.count > 0)
  const total = counts.reduce((s, p) => s + p.count, 0)
  const interactive = Boolean(onPhaseClick)
  const cols = Math.max(counts.length, 1)

  // Empty state — keep the bar from collapsing visually.
  if (counts.length === 0) {
    return (
      <div>
        <div className="h-3 rounded-full bg-navy/[0.06]" />
        <p className="text-center text-muted text-xs mt-3">
          No active deals — phases will appear as you add them.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Bar — visual distribution */}
      <div className="h-3 rounded-full overflow-hidden bg-navy/[0.06] flex gap-0.5">
        {counts.map(({ phase, count }) => {
          const pct = (count / total) * 100
          return (
            <div
              key={phase}
              className={`${SEGMENT_COLOR[phase] || 'bg-navy'} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${phase}: ${count}`}
            />
          )
        })}
      </div>

      {/* Labels — interactive when onPhaseClick is provided. Dynamic column
          count keeps spacing reasonable as the phase set grows/shrinks. */}
      <div
        className="grid gap-1 mt-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {counts.map(({ phase, count }) => {
          const style = PHASE_STYLES[phase] || PHASE_STYLES['Offer Accepted']
          const isActive = activePhase === phase

          if (!interactive) {
            return (
              <div key={phase} className="flex flex-col items-center text-center py-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="text-[10px] md:text-xs font-semibold text-navy truncate">
                    {SHORT_LABELS[phase] || phase}
                  </span>
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
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                <span className="text-[10px] md:text-xs font-semibold text-navy truncate">
                  {SHORT_LABELS[phase] || phase}
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
