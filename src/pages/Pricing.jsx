// Public pricing page. Pre-login marketing surface. Linked from the
// Landing page, footer, signup flow, and anywhere "see all tiers"
// makes sense. Tier data is duplicated here intentionally — this
// page is a marketing surface, not a feature-gating surface, so it
// doesn't need to import from the existing in-app tier sources.

import { Link } from 'react-router-dom'
import { INTELLIGENCE_COPY } from '../data/intelligenceCopy'

const TIERS = [
  {
    name: 'Core',
    price: 15,
    tagline: 'Everything to run your deals',
    status: 'available',
    features: [
      'Transaction dashboard',
      'Phase checklists with notes',
      'Quick Log (15 seconds)',
      'Lead tracker',
      'Showing scheduler',
      'Agent email blast',
      'Commission tracker',
      'Calendar & reference files',
      'Mobile + desktop',
    ],
  },
  {
    name: 'Pro',
    price: 20,
    tagline: 'Core + Client Portal',
    status: 'available',
    recommended: true,
    features: [
      'Everything in Core',
      'Client Portal — buyer & seller logins',
      'Client to-do list',
      'Pre-built task templates',
      'Multiple portals per deal',
      'Portal task notifications',
    ],
  },
  {
    name: 'Pro+',
    price: 25,
    tagline: 'Business Intelligence + Lender Directory',
    status: 'soon',
    eta: 'Coming Q3 2026',
    features: [
      'Everything in Pro',
      'Business intelligence dashboard',
      'Career earnings & totals',
      'Past client re-engagement',
      'Lender directory & matching',
      'Source performance leaderboard',
    ],
  },
  {
    name: 'Intelligence',
    price: INTELLIGENCE_COPY.price,
    tagline: 'AI Market Briefing + Rate Watch',
    status: 'soon',
    eta: INTELLIGENCE_COPY.status,
    features: [
      'Everything in Pro+',
      ...INTELLIGENCE_COPY.features.map((f) => f.name),
    ],
  },
]

export default function Pricing() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <header className="border-b border-navy/[0.08] bg-cream/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Deal<span className="text-gold">Flow</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              to="/login"
              className="text-sm font-semibold text-muted hover:text-navy transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="bg-gold hover:bg-gold-light text-navy text-sm font-bold rounded-lg px-4 py-2 transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="max-w-3xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10 text-center">
          <span className="inline-flex items-center gap-2 bg-navy text-gold text-[10px] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full">
            Founding Member
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold mt-6 leading-[1.05] tracking-tight">
            Simple pricing,<br />
            <em className="text-gold not-italic md:italic">grows with you.</em>
          </h1>
          <p className="text-navy/70 text-base md:text-lg mt-5 leading-relaxed max-w-xl mx-auto">
            30 days free. No credit card required.
          </p>
          <p className="text-sm md:text-base mt-3 max-w-xl mx-auto">
            <strong className="text-navy">$30 onboarding fee waived</strong>{' '}
            <span className="text-muted">during launch promo.</span>
          </p>
          <p className="text-muted text-xs md:text-sm mt-5 max-w-md mx-auto leading-snug">
            Lock in your rate today. Founding members upgrade free as new tiers launch.
          </p>
        </section>

        {/* ─── Pricing grid ─── */}
        <section className="max-w-7xl mx-auto px-5 md:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>
        </section>

        {/* ─── Intelligence tier preview block ─── */}
        <section className="bg-navy-dark text-white py-14 md:py-20">
          <div className="max-w-3xl mx-auto px-5 md:px-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-light text-center">
              Coming Soon — Intelligence Tier
            </p>
            <h2 className="font-display text-2xl md:text-4xl font-bold mt-4 text-center leading-tight">
              {INTELLIGENCE_COPY.subhead}
            </h2>
            <p className="text-white/75 text-sm md:text-base mt-6 leading-relaxed text-center">
              {INTELLIGENCE_COPY.headline}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
              {INTELLIGENCE_COPY.features.map((f) => (
                <div
                  key={f.name}
                  className="bg-white/[0.04] border border-white/10 rounded-xl p-5"
                >
                  <h3 className="font-display text-base font-bold text-gold-light">
                    {f.name}
                  </h3>
                  <p className="text-white/70 text-sm mt-2 leading-snug">
                    {f.framing}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-white/55 text-xs md:text-sm mt-8 leading-relaxed text-center max-w-xl mx-auto italic">
              {INTELLIGENCE_COPY.narrative}
            </p>
          </div>
        </section>

        {/* ─── Trust band + CTA ─── */}
        <section className="bg-navy text-white py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight">
              No tricks. No upsells.<br className="hidden md:block" />{' '}
              <em className="text-gold not-italic md:italic">Just transparent pricing.</em>
            </h2>
            <p className="text-white/70 text-sm md:text-base mt-5 leading-relaxed">
              Built and operated by Puente Translations LLC in Tampa, Florida. One founder. One team. One mission: give solo agents the tool they should have had 10 years ago.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-gold hover:bg-gold-light text-navy font-bold rounded-xl px-7 py-3 mt-8 text-sm md:text-base transition-colors"
            >
              Start your free 30 days
            </Link>
            <p className="text-white/50 text-xs mt-3">No credit card required</p>
          </div>
        </section>
      </main>

      <footer className="bg-navy-dark text-white py-8">
        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center">
          <p className="text-white/60 text-xs">
            &copy; 2026 Puente Translations LLC &middot;{' '}
            <Link to="/terms" className="text-gold-light hover:text-gold">Terms</Link>{' '}&middot;{' '}
            <Link to="/privacy" className="text-gold-light hover:text-gold">Privacy</Link>{' '}&middot;{' '}
            <a href="mailto:support@dealflownow.net" className="text-gold-light hover:text-gold">Support</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function TierCard({ tier }) {
  const isAvailable = tier.status === 'available'
  return (
    <div
      className={`relative bg-white rounded-2xl shadow-card p-6 flex flex-col ${
        tier.recommended ? 'border-2 border-gold' : 'border border-navy/[0.08]'
      } ${tier.status === 'soon' ? 'opacity-95' : ''}`}
    >
      {tier.recommended && (
        <span className="absolute -top-3 right-5 bg-gold text-navy text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Recommended
        </span>
      )}
      {tier.status === 'soon' && (
        <span className="absolute -top-3 right-5 bg-navy text-gold text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          {tier.eta}
        </span>
      )}
      <h3 className="font-display text-2xl font-bold text-navy mt-2">{tier.name}</h3>
      <p className="text-muted text-xs mt-1 min-h-[2.5em]">{tier.tagline}</p>
      <p className="font-display text-4xl font-bold text-navy mt-5 leading-none">
        <span className="text-2xl align-top">$</span>
        {tier.price}
        <span className="text-sm font-normal text-muted ml-1">/mo</span>
      </p>
      <ul className="mt-5 space-y-2 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-navy/85">
            <span className="text-gold font-bold mt-0.5 shrink-0">&#10003;</span>
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>
      {isAvailable ? (
        <Link
          to="/signup"
          className={`block w-full text-center font-bold rounded-xl py-3 mt-6 text-sm transition-colors ${
            tier.recommended
              ? 'bg-gold hover:bg-gold-light text-navy'
              : 'bg-navy hover:bg-navy-light text-white'
          }`}
        >
          Start free trial
        </Link>
      ) : (
        <div className="block w-full text-center font-bold rounded-xl py-3 mt-6 text-sm bg-navy/[0.04] text-navy/40 cursor-not-allowed">
          {tier.eta}
        </div>
      )}
    </div>
  )
}
