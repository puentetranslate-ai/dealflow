import { CheckIcon } from './Icon'

// Shared shell for all auth pages.
// Mobile: navy full-bleed with logo + tagline + white card.
// Desktop: split layout — navy feature panel on the left, white card on the right.

const FEATURES = [
  'Track every active transaction',
  'Log every call, text, and email',
  'Monitor your commission pipeline',
]

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-navy text-white flex flex-col md:flex-row">
      {/* ── Feature panel ── */}
      <section className="md:w-1/2 md:min-h-screen px-6 py-10 md:px-14 md:py-16 flex flex-col gold-grid-bg relative">
        {/* Mobile: compact logo + tagline */}
        <div className="md:hidden text-center">
          <div className="badge-gold mb-4">Built for Agents</div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Deal<span className="text-gold">Flow</span>
          </h1>
          <p className="text-muted text-sm mt-2">Real estate transactions, simplified.</p>
          <div className="mx-auto mt-5 h-px w-16 bg-gold/60" />
        </div>

        {/* Desktop: full feature pitch */}
        <div className="hidden md:flex flex-col h-full">
          <div className="badge-gold w-fit">Built for Agents</div>
          <div className="mt-8">
            <h1 className="font-display text-6xl font-bold tracking-tight leading-none">
              Deal<span className="text-gold">Flow</span>
            </h1>
            <p className="text-white/60 mt-4 text-lg">Real estate transactions, simplified.</p>
            <div className="mt-6 h-px w-20 bg-gold/60" />
          </div>

          <ul className="mt-12 space-y-5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-4">
                <span className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center shrink-0">
                  <CheckIcon className="w-5 h-5" />
                </span>
                <span className="text-white/90 text-base mt-1.5">{f}</span>
              </li>
            ))}
          </ul>

          <p className="mt-auto text-white/40 text-xs">
            Trusted by real estate agents nationwide.
          </p>
        </div>
      </section>

      {/* ── Form panel ── */}
      <section className="flex-1 flex items-start md:items-center justify-center px-5 pb-10 md:px-10 md:py-16 bg-cream md:bg-cream">
        <div className="w-full max-w-md -mt-8 md:mt-0">
          {children}
        </div>
      </section>
    </div>
  )
}
