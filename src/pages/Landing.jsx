import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STRIPE_URL = 'https://buy.stripe.com/cNiaEYgBtaIDePBac93F602'

const PROBLEMS = [
  {
    icon: '📧',
    title: 'Scattered Communications',
    body: 'Client emails in Gmail, texts on your phone, call notes on a legal pad. Nothing connects.',
  },
  {
    icon: '📋',
    title: 'Missed Deadlines',
    body: 'Inspection periods, appraisal deadlines, and contingency dates live in different places. One missed date can kill a deal.',
  },
  {
    icon: '🗂️',
    title: 'No Transaction Overview',
    body: "You can't see all your active deals at a glance. You dig through emails just to remember where each one stands.",
  },
  {
    icon: '💸',
    title: 'Subscription Fatigue',
    body: 'CRMs cost $50–$150 per month and are built for big brokerages — not solo agents who need something simple.',
  },
]

const FEATURES = [
  {
    icon: '🏠',
    title: 'Transaction Dashboard',
    body: 'See every active deal at a glance — phase, price, days in pipeline, and your next critical deadline.',
  },
  {
    icon: '💬',
    title: 'Communication Log',
    body: 'Every call, text, and email tied to a deal — logged, timestamped, searchable. Never lose a conversation.',
  },
  {
    icon: '✅',
    title: 'Phase-by-Phase Checklists',
    body: 'Pre-built checklists for every stage: Offer → Inspection → Appraisal → Title → Closing.',
  },
  {
    icon: '👥',
    title: 'Lead Tracker',
    body: 'Log every prospect, track where they came from, rate them Hot/Warm/Cold, convert to active deals with one tap.',
  },
  {
    icon: '💰',
    title: 'Commission Tracker',
    body: 'See pending and earned commission across all deals in real time. Know what\'s closing and when.',
  },
  {
    icon: '👤',
    title: 'Client Directory',
    body: 'Buyer and seller profiles with one-tap call and email. Always one click away.',
  },
]

const STEPS = [
  {
    n: 1,
    title: 'Sign up',
    body: "Create your account in 30 seconds. Card required — you won't be charged for 30 days. Cancel anytime.",
  },
  {
    n: 2,
    title: 'Add your deals',
    body: 'Enter your active transactions. Takes less than 2 minutes per deal.',
  },
  {
    n: 3,
    title: 'Run your business',
    body: 'Log calls, track deadlines, monitor commissions — all from your phone.',
  },
]

const PRICING = [
  {
    id: 'core',
    name: 'Core',
    price: 15,
    setup: 30,
    badge: 'Most Popular',
    available: true,
    features: [
      'Unlimited active transactions',
      'Phase-by-phase checklists',
      'Communication log per deal',
      'Lead tracker',
      'Commission tracker',
      'Client directory',
      'PDF export',
      'Mobile + desktop',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    setup: 30,
    available: false,
    features: [
      'Everything in Core, plus:',
      'Client portal — buyers and sellers get their own login',
      'Client to-do list',
      'Agent-client message thread',
    ],
    cta: 'Coming Soon',
  },
  {
    id: 'pro-plus',
    name: 'Pro+',
    price: 25,
    setup: 30,
    available: false,
    features: [
      'Everything in Pro, plus:',
      'Smart lender matching',
      'Lender directory and ratings',
      'Business intelligence dashboard',
      'Past client re-engagement alerts',
    ],
    cta: 'Coming Soon',
  },
]

const FAQS = [
  {
    q: 'Do I need to download an app?',
    a: 'No. DealFlow works in any browser on your phone or laptop. You can add it to your home screen for an app-like experience.',
  },
  {
    q: 'What happens after the 30-day trial?',
    a: 'Your card is automatically charged $15/month on day 31. Cancel anytime before then — no charge, no questions asked.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted and stored securely. Only you can see your deals, clients, and commissions.',
  },
  {
    q: 'Can I use this on my iPhone and Android?',
    a: 'Yes. DealFlow works on any phone browser — iPhone Safari, Android Chrome, anything.',
  },
  {
    q: 'What if I already use a CRM?',
    a: 'DealFlow is focused on active transaction management — not lead generation or email blasts. Most agents use it alongside their existing tools.',
  },
  {
    q: 'How is this different from Dotloop or Follow Up Boss?',
    a: 'Those are built for teams and brokerages at $50-150/month. DealFlow is built for solo agents at $15/month with a mobile-first experience designed for the field.',
  },
]

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  // Smooth scroll for anchor links — opt-in via class so we don't override
  // the rest of the app's default scroll behavior.
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = prev }
  }, [])

  return (
    <div className="bg-white text-navy font-sans">
      <Nav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <DashboardPreview />
      <Pricing />
      <FAQSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <FinalCTA />
      <Footer />
    </div>
  )
}

// ─────────────────────────── Nav ───────────────────────────
function Nav({ mobileOpen, setMobileOpen }) {
  return (
    <header className="sticky top-0 z-50 bg-navy text-white border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="font-display text-2xl font-bold tracking-tight">
          Deal<span className="text-gold">Flow</span>
        </a>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="border border-white/30 text-white hover:bg-white/[0.06] font-semibold rounded-xl px-5 h-10 flex items-center transition-colors"
          >
            Sign In
          </Link>
          <a
            href={STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-5 h-10 flex items-center transition-colors"
          >
            Start Free Trial
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-white/80 hover:text-white"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-navy">
          <div className="px-5 py-4 flex flex-col gap-3">
            <Link
              to="/login"
              className="border border-white/30 text-white text-center font-semibold rounded-xl px-5 h-12 flex items-center justify-center"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
            <a
              href={STRIPE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gold text-navy text-center font-semibold rounded-xl px-5 h-12 flex items-center justify-center"
              onClick={() => setMobileOpen(false)}
            >
              Start Free Trial
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

// ─────────────────────────── Hero ───────────────────────────
function Hero() {
  return (
    <section id="top" className="relative bg-navy text-white overflow-hidden gold-grid-bg">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="text-center md:text-left">
          <span className="badge-gold">Now Live — Beta Pricing Available</span>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] mt-5 text-balance">
            Every deal. Every client. <span className="text-gold">One screen.</span>
          </h1>
          <p className="text-white/70 text-base md:text-lg mt-5 leading-relaxed max-w-xl md:max-w-none mx-auto md:mx-0">
            DealFlow is the mobile-first transaction manager built exclusively for real estate agents. Replace the chaos of sticky notes, scattered emails, and five disconnected apps with one beautiful tool.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-7 sm:items-center justify-center md:justify-start">
            <a
              href={STRIPE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-6 h-12 flex items-center justify-center transition-colors"
            >
              Start Free — 30 Days
            </a>
            <a
              href="#how-it-works"
              className="border border-white/30 text-white hover:bg-white/[0.06] font-semibold rounded-xl px-6 h-12 flex items-center justify-center transition-colors"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center md:justify-start gap-2 text-white/50 text-xs flex-wrap">
            <span>30-day free trial</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>Works on any phone</span>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center md:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── Phone mockup ───────────────────────────
function PhoneMockup() {
  return (
    <div className="relative">
      {/* Phone frame */}
      <div className="w-[280px] md:w-[320px] aspect-[9/19] bg-navy-dark rounded-[40px] border-4 border-navy-light shadow-2xl overflow-hidden p-1.5">
        <div className="w-full h-full bg-cream rounded-[32px] overflow-hidden flex flex-col">
          {/* Phone status bar */}
          <div className="h-6 bg-navy flex items-center justify-center">
            <div className="w-20 h-4 bg-navy-dark rounded-full" />
          </div>
          {/* Mock screen */}
          <div className="flex-1 overflow-hidden bg-navy text-white px-4 pt-4">
            <p className="text-gold text-[10px] font-bold uppercase tracking-wider">Good morning, Alex</p>
            <p className="font-display text-base font-bold leading-tight mt-1">
              You have <span className="text-gold">6</span> deals in play.
            </p>
          </div>
          <div className="bg-cream flex-1 px-3 py-3 space-y-2 overflow-hidden">
            <div className="bg-white rounded-lg p-2 border-l-2 border-amber-500 shadow-sm">
              <p className="text-[10px] font-bold text-navy leading-tight">1247 Bayshore Blvd</p>
              <p className="text-[8px] text-amber-700 font-semibold mt-0.5">● Inspection</p>
              <p className="text-[8px] text-navy mt-0.5">$585,000</p>
            </div>
            <div className="bg-white rounded-lg p-2 border-l-2 border-orange-500 shadow-sm">
              <p className="text-[10px] font-bold text-navy leading-tight">3402 W Cypress St</p>
              <p className="text-[8px] text-orange-700 font-semibold mt-0.5">● Appraisal</p>
              <p className="text-[8px] text-navy mt-0.5">$429,000</p>
            </div>
            <div className="bg-white rounded-lg p-2 border-l-2 border-green-500 shadow-sm">
              <p className="text-[10px] font-bold text-navy leading-tight">5018 S MacDill Ave</p>
              <p className="text-[8px] text-green-700 font-semibold mt-0.5">● Clear to Close</p>
              <p className="text-[8px] text-navy mt-0.5">$725,000</p>
            </div>
          </div>
        </div>
      </div>
      {/* Notch */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-navy-dark rounded-b-2xl" />
    </div>
  )
}

// ─────────────────────────── Problem ───────────────────────────
function ProblemSection() {
  return (
    <section className="bg-cream py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-navy text-center text-balance leading-tight">
          You're running your business out of five apps, sticky notes, and memory.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 mt-12">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="bg-navy text-white rounded-2xl p-6 md:p-7">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-display text-lg font-bold leading-tight">{p.title}</h3>
              <p className="text-white/70 text-sm mt-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── Features ───────────────────────────
function FeaturesSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-navy text-center text-balance leading-tight">
          Everything you need — and nothing you don't.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white border border-navy/[0.06] shadow-card p-6 border-t-4 border-t-gold"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-display text-lg font-bold text-navy mt-3 leading-tight">{f.title}</h3>
              <p className="text-muted text-sm mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── How It Works ───────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-cream py-16 md:py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-navy text-center text-balance leading-tight">
          Up and running in minutes.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 mt-12 relative">
          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-gold/30 pointer-events-none" />
          {STEPS.map((s) => (
            <div key={s.n} className="relative text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-cream border-2 border-gold text-gold-dark font-display text-3xl font-bold flex items-center justify-center relative z-10">
                {s.n}
              </div>
              <h3 className="font-display text-xl font-bold text-navy mt-4 leading-tight">{s.title}</h3>
              <p className="text-muted text-sm mt-2 leading-relaxed max-w-xs mx-auto">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── Dashboard Preview ───────────────────────────
function DashboardPreview() {
  return (
    <section className="bg-navy py-16 md:py-24 gold-grid-bg">
      <div className="max-w-6xl mx-auto px-5 md:px-8 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-white text-balance leading-tight">
          See it in action.
        </h2>
        <p className="text-white/70 text-base md:text-lg mt-3">
          Clean. Fast. Built around how agents actually work.
        </p>

        {/* Browser frame */}
        <div className="mt-12 mx-auto max-w-4xl text-left">
          <div className="bg-white rounded-t-2xl shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="bg-cream-dark/50 border-b border-navy/10 px-4 py-2.5 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 px-3 py-1 bg-white rounded-md text-xs text-muted text-center">
                dealflownow.net/dashboard
              </div>
            </div>
            <DashboardMock />
          </div>
        </div>
      </div>
    </section>
  )
}

function DashboardMock() {
  return (
    <div className="flex bg-cream">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-48 lg:w-56 bg-navy text-white py-5 px-4 shrink-0">
        <p className="font-display text-xl font-bold">
          Deal<span className="text-gold">Flow</span>
        </p>
        <p className="text-muted text-[10px] mt-0.5">Agent Workspace</p>
        <nav className="mt-6 space-y-1 text-xs">
          <div className="px-3 py-2 rounded-lg bg-white/[0.06] text-white relative">
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gold rounded-r" />
            Dashboard
          </div>
          <div className="px-3 py-2 text-white/60">Clients</div>
          <div className="px-3 py-2 text-white/60">Leads</div>
          <div className="px-3 py-2 text-white/60">Commission</div>
          <div className="px-3 py-2 text-white/60">Settings</div>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-6 min-w-0">
        <p className="text-muted text-[11px] font-medium">Thursday, April 23 · Good morning, <span className="text-gold-dark font-semibold">Alex</span></p>
        <h3 className="font-display text-lg md:text-xl font-bold text-navy mt-1">
          You have <span className="text-gold-dark">6</span> active deals
        </h3>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-xl p-3 shadow-soft border border-navy/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Active Deals</p>
            <p className="font-display text-xl font-bold text-navy mt-1 leading-none">6</p>
          </div>
          <div className="bg-navy rounded-xl p-3 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-gold/10 rounded-full -translate-y-4 translate-x-4 pointer-events-none" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-gold relative">Pending Commission</p>
            <p className="font-display text-xl font-bold text-gold mt-1 leading-none relative">$38,400</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-soft border border-navy/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Deadlines This Week</p>
            <p className="font-display text-xl font-bold text-orange-500 mt-1 leading-none">3</p>
          </div>
        </div>

        {/* Deal rows */}
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mt-5 mb-2">Active Transactions</p>
        <div className="space-y-2">
          <DealRow address="1247 Bayshore Blvd" city="Tampa, FL" price="$585,000" days={12} phase="Inspection" tone="amber" />
          <DealRow address="3402 W Cypress St" city="Tampa, FL" price="$429,000" days={8} phase="Appraisal" tone="orange" />
          <DealRow address="5018 S MacDill Ave" city="Tampa, FL" price="$725,000" days={21} phase="Clear to Close" tone="green" />
        </div>
      </main>
    </div>
  )
}

function DealRow({ address, city, price, days, phase, tone }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  return (
    <div className="bg-white rounded-xl p-3 border border-navy/[0.04] shadow-soft flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-navy truncate leading-tight">{address}</p>
        <p className="text-[10px] text-muted">{city}</p>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>● {phase}</span>
        <span className="text-[10px] text-muted">{days}d active</span>
      </div>
      <p className="font-display text-sm font-bold text-gold-dark whitespace-nowrap shrink-0">{price}</p>
    </div>
  )
}

// ─────────────────────────── Pricing ───────────────────────────
function Pricing() {
  return (
    <section id="pricing" className="bg-white py-16 md:py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-navy text-center text-balance leading-tight">
          Simple, transparent pricing.
        </h2>
        <p className="text-muted text-center text-base md:text-lg mt-3">
          Start free for 30 days. Cancel anytime. No hidden fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {PRICING.map((tier) => <PricingCard key={tier.id} tier={tier} />)}
        </div>
      </div>
    </section>
  )
}

function PricingCard({ tier }) {
  const isHero = tier.id === 'core'
  return (
    <div className={`relative rounded-2xl p-6 md:p-7 flex flex-col ${
      isHero
        ? 'bg-navy text-white shadow-pop ring-2 ring-gold/40'
        : 'bg-white text-navy border border-navy/[0.06] shadow-card'
    }`}>
      {tier.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          {tier.badge}
        </span>
      )}
      {!tier.available && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-navy/10 text-navy/60 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Coming Soon
        </span>
      )}

      <h3 className={`font-display text-2xl font-bold ${isHero ? 'text-white' : 'text-navy'}`}>
        {tier.name}
      </h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`font-display text-4xl font-bold ${isHero ? 'text-gold' : 'text-navy'}`}>
          ${tier.price}
        </span>
        <span className={`text-sm ${isHero ? 'text-white/60' : 'text-muted'}`}>/month</span>
      </div>
      <p className={`text-xs mt-1 ${isHero ? 'text-white/60' : 'text-muted'}`}>
        ${tier.setup} one-time onboarding fee
      </p>

      <ul className={`mt-6 space-y-2.5 text-sm ${isHero ? 'text-white/90' : 'text-navy'}`}>
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 ${isHero ? 'text-gold' : 'text-gold-dark'}`}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-6 border-t border-current/[0.08]">
        {tier.available ? (
          <>
            <a
              href={STRIPE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-5 h-12 leading-[3rem] transition-colors"
            >
              {tier.cta}
            </a>
            <p className={`text-center text-xs mt-3 ${isHero ? 'text-white/60' : 'text-muted'}`}>
              Beta testers — enter your code at checkout for $0 onboarding fee.
            </p>
          </>
        ) : (
          <span className="block text-center bg-navy/[0.06] text-navy/40 font-semibold rounded-xl px-5 h-12 leading-[3rem] cursor-not-allowed">
            {tier.cta}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── FAQ ───────────────────────────
function FAQSection({ openFaq, setOpenFaq }) {
  return (
    <section id="faq" className="bg-white py-16 md:py-24 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-navy text-center text-balance leading-tight">
          Common questions.
        </h2>

        <div className="mt-10 space-y-3">
          {FAQS.map((item, i) => {
            const open = openFaq === i
            return (
              <div
                key={item.q}
                className={`rounded-2xl border transition-colors ${
                  open ? 'border-gold/40 bg-gold/[0.04]' : 'border-navy/[0.08] bg-white'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(open ? -1 : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 min-h-[56px]"
                  aria-expanded={open}
                >
                  <span className="font-display text-base md:text-lg font-bold text-navy">{item.q}</span>
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    open ? 'bg-gold text-navy rotate-45' : 'bg-navy/[0.06] text-navy'
                  }`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-5 -mt-1 text-muted text-sm leading-relaxed animate-fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── Final CTA ───────────────────────────
function FinalCTA() {
  return (
    <section className="bg-navy text-white text-center py-16 md:py-24 gold-grid-bg">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-balance leading-tight">
          Ready to run your business like a pro?
        </h2>
        <p className="text-white/70 text-base md:text-lg mt-4">
          Start managing your deals the smart way. 30 days free — no risk.
        </p>
        <a
          href={STRIPE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-8 h-14 mt-8 text-base transition-colors"
        >
          Start Free Trial
        </a>
        <p className="text-white/50 text-xs mt-4">
          30-day free trial · $30 onboarding + $15/month after · Cancel anytime
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────── Footer ───────────────────────────
function Footer() {
  return (
    <footer className="bg-navy-dark text-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">
            Deal<span className="text-gold">Flow</span>
          </p>
          <p className="text-white/60 text-sm mt-2">Real estate transactions, simplified.</p>
          <a href="https://dealflownow.net" className="text-gold-light text-sm mt-3 inline-block hover:text-gold">
            dealflownow.net
          </a>
        </div>

        <FooterCol title="Product" items={[
          { label: 'Features', href: '#features' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'How It Works', href: '#how-it-works' },
          { label: 'FAQ', href: '#faq' },
        ]} />

        <FooterCol title="Account" items={[
          { label: 'Sign In', to: '/login' },
          { label: 'Sign Up', to: '/signup' },
          { label: 'Free Trial', href: STRIPE_URL, external: true },
        ]} />

        <FooterCol title="Contact" items={[
          { label: 'jimmy@puente-translations.com', href: 'mailto:jimmy@puente-translations.com' },
        ]} />
      </div>

      <div className="border-t border-white/[0.06] py-6 text-center text-white/40 text-xs">
        © 2026 DealFlow. All rights reserved.
      </div>
    </footer>
  )
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <Link to={item.to} className="text-white/70 hover:text-white transition-colors">
                {item.label}
              </Link>
            ) : (
              <a
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="text-white/70 hover:text-white transition-colors break-all"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
