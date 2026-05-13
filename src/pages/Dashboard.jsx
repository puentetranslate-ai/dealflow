import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, calcCommission, daysUntil, isPastDue } from '../lib/utils'
import { TEMP_STYLES } from '../lib/leadConstants'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import DealCard from '../components/DealCard'
import StatCard from '../components/StatCard'
import PipelineBar from '../components/PipelineBar'
import LoadingSpinner from '../components/LoadingSpinner'
import Fab from '../components/Fab'
import { ArrowRightIcon, BellIcon, FunnelIcon, XIcon, HouseIcon } from '../components/Icon'
import ShowingCard from '../components/ShowingCard'
import WelcomeModal from '../components/WelcomeModal'
import TrialBanner from '../components/TrialBanner'
import { runDailyNotificationCheck } from '../lib/pushNotifications'

const SORT_OPTIONS = [
  { id: 'created_desc', label: 'Newest first' },
  { id: 'closing_asc', label: 'Closing soonest' },
  { id: 'price_desc', label: 'Highest price' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'buyer', label: "Buyer Side" },
  { id: 'seller', label: "Seller Side" },
]

const FILTERS_DESKTOP = [
  { id: 'all', label: 'All' },
  { id: 'buyer', label: "As Buyer's Agent" },
  { id: 'seller', label: 'As Listing Agent' },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const phaseFilter = searchParams.get('phase')
  const transactionsRef = useRef(null)
  const [deals, setDeals] = useState([])
  const [deadlineItems, setDeadlineItems] = useState([])
  const [leads, setLeads] = useState([])
  const [todaysShowings, setTodaysShowings] = useState([])
  const [profileName, setProfileName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('created_desc')
  const [search, setSearch] = useState('')

  const scrollToTransactions = () => {
    transactionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePhaseClick = (phase) => {
    setSearchParams(phase === phaseFilter ? {} : { phase })
    // Defer scroll until the URL update has rendered the chip
    setTimeout(scrollToTransactions, 50)
  }

  const clearPhaseFilter = () => setSearchParams({})

  // Post-upgrade celebration toast — when Stripe redirects back to
  // /dashboard?upgraded=<tier> after a successful checkout, show a
  // one-time confirmation tailored to which tier they bought, then
  // strip the query param so a refresh doesn't re-trigger it.
  // Recognized tier values: 'pro' (Client Portal unlocked),
  // 'core' (full transaction suite, no Portal yet).
  const [upgradedTier, setUpgradedTier] = useState(null)
  useEffect(() => {
    const upgraded = searchParams.get('upgraded')
    if (upgraded !== 'pro' && upgraded !== 'core') return
    setUpgradedTier(upgraded)
    // Remove the query param without leaving a history entry — the
    // Back button shouldn't take the user to a "?upgraded=..." URL
    // they've already dismissed.
    const next = new URLSearchParams(searchParams)
    next.delete('upgraded')
    setSearchParams(next, { replace: true })
    const dismissTimer = setTimeout(() => setUpgradedTier(null), 5000)
    return () => clearTimeout(dismissTimer)
    // We only want this to fire on initial mount with the param present,
    // not on every searchParams change (that would loop forever).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const todayKey = new Date().toISOString().split('T')[0]

      const [profileRes, dealsRes, leadsRes, showingsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase
          .from('deals')
          .select('*')
          .eq('user_id', user.id)
          .neq('phase', 'Closed')
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select('id, temperature, follow_up_date, converted_to_deal_id')
          .eq('user_id', user.id)
          .is('converted_to_deal_id', null),
        supabase
          .from('showings')
          .select('*')
          .eq('user_id', user.id)
          .eq('showing_date', todayKey)
          .order('showing_time', { ascending: true, nullsFirst: false }),
      ])

      setProfileName(profileRes.data?.full_name || user.user_metadata?.full_name || '')
      if (dealsRes.error) throw dealsRes.error
      setDeals(dealsRes.data || [])
      setLeads(leadsRes.data || [])
      setTodaysShowings(showingsRes.data || [])

      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, deal_id, label, due_date')
        .eq('user_id', user.id)
        .eq('is_checked', false)
        .not('due_date', 'is', null)
        .gte('due_date', today)
        .lte('due_date', nextWeek)
        .order('due_date', { ascending: true })

      setDeadlineItems(items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { fetchData() }, [fetchData])

  // Once per session, after data loads, fire any due notifications.
  useEffect(() => {
    runDailyNotificationCheck(user.id)
  }, [user.id])

  // Stats
  const buyerCount = deals.filter((d) => d.agent_role === 'buyer').length
  const sellerCount = deals.filter((d) => d.agent_role === 'seller').length
  const pendingCommission = deals.reduce(
    (sum, d) => sum + calcCommission(d.sale_price, d.commission_pct),
    0
  )
  const avgCommissionPct = deals.length
    ? deals.reduce((s, d) => s + (parseFloat(d.commission_pct) || 0), 0) / deals.length
    : 0

  const todayKey = new Date().toISOString().split('T')[0]
  const todayDeadlines = deadlineItems.filter((i) => i.due_date === todayKey).length
  const soonDeadlines = deadlineItems.length - todayDeadlines
  const urgentTomorrowDeadlines = deadlineItems.filter((i) => {
    const days = daysUntil(i.due_date)
    return days !== null && days >= 0 && days <= 1
  }).length

  // Filter + sort
  const visibleDeals = useMemo(() => {
    let list = [...deals]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.address?.toLowerCase().includes(q) ||
          d.buyer_name?.toLowerCase().includes(q) ||
          d.seller_name?.toLowerCase().includes(q)
      )
    }

    if (filter === 'buyer') list = list.filter((d) => d.agent_role === 'buyer')
    if (filter === 'seller') list = list.filter((d) => d.agent_role === 'seller')
    if (filter === 'urgent') {
      list = list.filter((d) => {
        const days = d.closing_date ? daysUntil(d.closing_date) : null
        return days !== null && days <= 7
      })
    }

    if (phaseFilter) {
      list = list.filter((d) => d.phase === phaseFilter)
    }

    if (sort === 'closing_asc') {
      list.sort((a, b) => {
        const da = a.closing_date ? new Date(a.closing_date).getTime() : Infinity
        const db = b.closing_date ? new Date(b.closing_date).getTime() : Infinity
        return da - db
      })
    } else if (sort === 'price_desc') {
      list.sort((a, b) => (b.sale_price || 0) - (a.sale_price || 0))
    }
    // created_desc is the natural order from the query

    return list
  }, [deals, filter, sort, search, phaseFilter])

  const nextDeadlineForDeal = (dealId) =>
    deadlineItems.find((i) => i.deal_id === dealId) || null

  const firstName = (profileName || user.email || '').split(/[\s@]+/)[0] || 'Agent'
  const dateLabel = format(new Date(), 'EEEE, MMMM d')

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <WelcomeModal userId={user.id} firstName={firstName} />

      {/* ── Post-upgrade celebration toast ── */}
      {upgradedTier && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw] md:max-w-md
                     bg-navy text-white rounded-2xl shadow-pop border border-gold/30
                     px-5 py-4 flex items-start gap-3 animate-fade-in"
        >
          <span className="text-2xl leading-none mt-0.5" aria-hidden="true">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm md:text-base font-bold">
              Welcome to DealFlow{' '}
              <span className="text-gold">
                {upgradedTier === 'pro' ? 'Pro!' : 'Core!'}
              </span>
            </p>
            <p className="text-white/70 text-xs md:text-sm mt-0.5">
              {upgradedTier === 'pro'
                ? 'Client Portal is now unlocked.'
                : "You're all set — every transaction tool is yours."}
            </p>
          </div>
          <button
            onClick={() => setUpgradedTier(null)}
            aria-label="Dismiss"
            className="text-white/40 hover:text-white shrink-0 -mr-1 -mt-1 p-1"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Mobile Header ── */}
      <MobileHeader showBell title={null}>
        <p className="text-gold text-xs font-semibold uppercase tracking-[0.14em]">
          {greeting()}, {firstName}
        </p>
        <h1 className="font-display text-2xl font-bold text-white leading-tight mt-1 text-balance">
          You have <span className="text-gold">{deals.length}</span>{' '}
          {deals.length === 1 ? 'deal' : 'deals'} in play.
        </h1>
      </MobileHeader>

      {/* ── Desktop Top Bar ── */}
      <TopBar search={search} onSearchChange={setSearch} />

      {/* ── Desktop greeting ── */}
      <div className="hidden md:block px-8 pt-2 pb-4">
        <p className="text-muted text-sm font-medium">
          {dateLabel} · {greeting()}, <span className="text-gold-dark font-semibold">{firstName}</span>
        </p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1 text-balance">
          You have <span className="text-gold-dark">{deals.length}</span>{' '}
          active {deals.length === 1 ? 'deal' : 'deals'}
          {urgentTomorrowDeadlines > 0 && (
            <>
              {' and '}
              <span className="text-orange-500">{urgentTomorrowDeadlines}</span>{' '}
              {urgentTomorrowDeadlines === 1 ? 'urgent deadline' : 'urgent deadlines'} tomorrow
            </>
          )}
          .
        </h1>
      </div>

      <div className="px-5 md:px-8 pb-32 md:pb-12">
        {/* Trial banner — only renders when ≤9 days remain */}
        <div className="pt-5 md:pt-2">
          <TrialBanner />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 my-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* ── Stats: mobile 2 cols, desktop 3 cols ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          <StatCard
            label="Active Deals"
            value={deals.length}
            trend={`${buyerCount} buyer · ${sellerCount} seller`}
            trendTone="muted"
            onClick={scrollToTransactions}
          />
          <StatCard
            label="Pending Commission"
            value={formatCurrency(pendingCommission)}
            tone="gold"
            variant="navy"
            onClick={() => navigate('/commission')}
          >
            {deals.length} open {deals.length === 1 ? 'transaction' : 'transactions'}
          </StatCard>
          <StatCard
            label="Deadlines This Week"
            value={deadlineItems.length}
            tone={deadlineItems.length > 0 ? 'orange' : 'navy'}
            onClick={() => navigate('/commission')}
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {todayDeadlines} today
              </span>
              <span className="text-muted/60">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> {soonDeadlines} soon
              </span>
            </span>
          </StatCard>
        </div>

        {/* ── Pipeline ──
            Whole card is tappable → /commission. Inner phase labels handle
            their own clicks (see PipelineBar — they stopPropagation). The
            "View full pipeline" link also stopPropagations to avoid double-firing.
        */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/commission')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate('/commission')
            }
          }}
          className="card cursor-pointer hover:scale-[1.02] hover:shadow-pop transition-all duration-200 p-5 md:p-6 mt-4 md:mt-5 group"
          aria-label="View full pipeline"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title mb-0">Pipeline</p>
              <p className="text-navy font-semibold text-sm mt-1">
                {deals.length} {deals.length === 1 ? 'deal' : 'deals'} in progress
              </p>
            </div>
            <span className="hidden md:flex items-center gap-1 text-xs font-semibold text-gold-dark transition-colors">
              View full pipeline
              <ArrowRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <PipelineBar
            deals={deals}
            onPhaseClick={handlePhaseClick}
            activePhase={phaseFilter}
          />
        </div>

        {/* ── Leads Pipeline ── */}
        <LeadsPipelineCard leads={leads} onClick={() => navigate('/leads')} />

        {/* ── Today's Showings ── */}
        {todaysShowings.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <HouseIcon className="w-4 h-4 text-cyan-700" />
              <h2 className="font-display text-xl font-bold text-navy">
                Today's {todaysShowings.length === 1 ? 'Showing' : 'Showings'}
              </h2>
              <span className="text-xs text-muted">· {todaysShowings.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todaysShowings.map((s) => (
                <ShowingCard
                  key={s.id}
                  showing={s}
                  compact
                  onUpdate={(u) => setTodaysShowings((prev) => prev.map((x) => x.id === u.id ? u : x))}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Active Transactions ── */}
        <div ref={transactionsRef} id="active-transactions" className="mt-6 scroll-mt-24">
          {phaseFilter && (
            <div className="mb-3 inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full pl-3 pr-1.5 py-1">
              <span className="text-xs font-semibold text-gold-dark">
                Phase: {phaseFilter}
              </span>
              <button
                onClick={clearPhaseFilter}
                className="w-6 h-6 rounded-full text-gold-dark hover:bg-gold/20 flex items-center justify-center transition-colors"
                aria-label="Clear phase filter"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-navy">Active Transactions</h2>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs font-semibold text-navy bg-white border border-navy/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Filter tabs (different copy desktop vs mobile, both rendered, one hidden by CSS) */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {FILTERS.map((f) => (
              <FilterPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </FilterPill>
            ))}
          </div>
          <div className="hidden md:flex gap-2 pb-2">
            {FILTERS_DESKTOP.map((f) => (
              <FilterPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </FilterPill>
            ))}
          </div>

          {/* Cards */}
          {visibleDeals.length === 0 ? (
            <EmptyState
              hasAnyDeals={deals.length > 0}
              filter={filter}
              onAdd={() => navigate('/deals/new')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-4">
              {visibleDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  nextDeadline={nextDeadlineForDeal(deal.id)}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Fab />
    </AppLayout>
  )
}

function LeadsPipelineCard({ leads, onClick }) {
  const counts = { Hot: 0, Warm: 0, Cold: 0 }
  let needFollowUp = 0
  const todayKey = new Date().toISOString().split('T')[0]
  leads.forEach((l) => {
    if (counts[l.temperature] != null) counts[l.temperature]++
    if (l.follow_up_date && (l.follow_up_date <= todayKey || isPastDue(l.follow_up_date))) {
      needFollowUp++
    }
  })

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-hover w-full text-left p-5 md:p-6 mt-4 md:mt-5 group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center shrink-0">
            <FunnelIcon className="w-4 h-4" />
          </span>
          <div>
            <p className="section-title mb-0">Leads Pipeline</p>
            <p className="text-navy font-semibold text-sm mt-1">
              {leads.length} active {leads.length === 1 ? 'lead' : 'leads'}
            </p>
          </div>
        </div>
        <ArrowRightIcon className="w-4 h-4 text-muted group-hover:text-gold-dark transition-colors" />
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {['Hot', 'Warm', 'Cold'].map((t) => {
          const style = TEMP_STYLES[t]
          return (
            <div
              key={t}
              className={`rounded-xl px-3 py-3 ${style.soft} flex items-center gap-2`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy/60 leading-none">{t}</p>
                <p className="font-display text-xl font-bold text-navy mt-1 leading-none">{counts[t]}</p>
              </div>
            </div>
          )
        })}
      </div>

      {needFollowUp > 0 && (
        <p className="text-red-600 text-xs font-semibold mt-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {needFollowUp} {needFollowUp === 1 ? 'lead needs' : 'leads need'} follow-up today
        </p>
      )}
    </button>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition-colors ${
        active
          ? 'bg-navy text-white'
          : 'bg-white text-navy/70 border border-navy/10 hover:border-navy/30'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ hasAnyDeals, filter, onAdd }) {
  if (hasAnyDeals) {
    return (
      <div className="text-center py-16 mt-2">
        <p className="text-navy font-semibold">No deals match this filter.</p>
        <p className="text-muted text-sm mt-1">Try a different tab.</p>
      </div>
    )
  }
  return (
    <div className="text-center py-16 mt-2">
      <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <BellIcon className="w-7 h-7 text-navy/30" />
      </div>
      <p className="text-navy font-semibold">No active deals yet</p>
      <p className="text-muted text-sm mt-1">Add your first transaction to start tracking.</p>
      <button onClick={onAdd} className="btn-primary mt-5 inline-flex w-auto px-6">
        + New Deal
      </button>
    </div>
  )
}
