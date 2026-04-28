import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQuickLog } from '../context/QuickLogContext'
import { formatCurrency } from '../lib/utils'
import {
  fetchMortgageRates, fetchFedFundsRate, fetchCaseShiller, fetchUnemployment,
  latest, changeWeeksAgo, changeFromN, monthlyPayment, purchasePowerFromBudget,
  nextFedMeeting, FED_MEETINGS_2026,
} from '../lib/marketData'
import LoadingSpinner from './LoadingSpinner'
import {
  TrendUpIcon, TrendDownIcon, BarChartIcon, ArrowRightIcon, BoltIcon, CalendarIcon,
} from './Icon'

// Market intelligence tab — pulls FRED public data and overlays it on the
// agent's own deals/leads. Every section degrades gracefully if the FRED
// fetch fails.

export default function MarketTab() {
  const { user } = useAuth()
  const [market, setMarket] = useState({ loading: true })
  const [deals, setDeals] = useState([])
  const [leads, setLeads] = useState([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchMortgageRates(),
      fetchFedFundsRate(),
      fetchCaseShiller(),
      fetchUnemployment(),
      supabase.from('deals').select('*').eq('user_id', user.id),
      supabase.from('leads').select('*').eq('user_id', user.id),
    ]).then(([m30, ff, cs, ur, dealsRes, leadsRes]) => {
      if (cancelled) return
      setMarket({
        loading: false,
        mortgage: m30,
        fedFunds: ff,
        caseShiller: cs,
        unemployment: ur,
      })
      setDeals(dealsRes.data || [])
      setLeads(leadsRes.data || [])
    })
    return () => { cancelled = true }
  }, [user.id])

  if (market.loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  }

  return (
    <div className="px-5 md:px-8 pt-5 pb-32 md:pb-12 space-y-6">
      <RateWatch mortgage={market.mortgage} />
      <DealSignals deals={deals} leads={leads} mortgage={market.mortgage} />
      <MarketPulse {...market} />
      <AgentInsights deals={deals} leads={leads} mortgage={market.mortgage} caseShiller={market.caseShiller} />
      <FedCalendar />
    </div>
  )
}

// ─────────────────────────── 1. Rate Watch ───────────────────────────
function RateWatch({ mortgage }) {
  const series = mortgage?.series || []
  const cur = latest(series)
  const wkChg = changeWeeksAgo(series, 1)
  const moChg = changeWeeksAgo(series, 4)

  if (!cur || mortgage?.error) {
    return (
      <Section eyebrow="Rates" title="Rate Watch">
        <Unavailable />
      </Section>
    )
  }

  const direction = wkChg ? Math.sign(wkChg.delta) : 0
  const interp = direction < 0
    ? 'Rates dropped this week — good time to remind buyer clients to lock in.'
    : direction > 0
    ? 'Rates rose this week — buyers may want to act before further increases.'
    : 'Rates held steady this week.'

  // Last 12 weeks for sparkline
  const last12 = series.slice(-12)
  const min = Math.min(...last12.map((p) => p.value))
  const max = Math.max(...last12.map((p) => p.value))
  const range = Math.max(0.01, max - min)

  return (
    <Section eyebrow="Rates" title="Rate Watch" subtitle={`30-year fixed · as of ${format(parseISO(cur.date), 'MMM d')}`}>
      <div className="card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          <div>
            <p className="font-display text-5xl md:text-6xl font-bold text-navy leading-none">
              {cur.value.toFixed(2)}%
            </p>
            <p className="text-muted text-xs mt-2 max-w-sm">{interp}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <ChangePill label="vs last week" change={wkChg} />
            <ChangePill label="vs last month" change={moChg} />
          </div>
        </div>

        {/* Sparkline */}
        <div className="mt-6 pt-5 border-t border-navy/[0.05]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Last 12 weeks</p>
          <Sparkline data={last12} min={min} max={max} range={range} />
        </div>
      </div>
    </Section>
  )
}

function Sparkline({ data, min, max, range }) {
  // Simple SVG polyline. Width is responsive; height fixed at 56px.
  const W = 100, H = 56
  const last = data[data.length - 1]?.value
  const first = data[0]?.value
  const trendUp = last > first
  const stroke = trendUp ? 'stroke-red-500' : 'stroke-green-500'

  const points = data.map((p, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((p.value - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-14 mt-2">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ChangePill({ label, change }) {
  if (!change) return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-semibold text-sm text-navy/40 mt-1">—</p>
    </div>
  )
  const up = change.delta > 0
  const flat = change.delta === 0
  const Icon = up ? TrendUpIcon : flat ? null : TrendDownIcon
  const tone = flat ? 'text-muted' : up ? 'text-red-600' : 'text-green-600'
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`flex items-center gap-1 font-semibold text-sm mt-1 ${tone}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {(change.delta >= 0 ? '+' : '') + change.delta.toFixed(2)}%
      </p>
    </div>
  )
}

// ─────────────────────────── 2. Deal Signals ───────────────────────────
function DealSignals({ deals, leads, mortgage }) {
  const cur = latest(mortgage?.series || [])
  if (!cur) {
    return (
      <Section eyebrow="Personal" title="Your Deal Signals">
        <Unavailable />
      </Section>
    )
  }

  const buyerDeals = deals
    .filter((d) => d.agent_role === 'buyer' && d.phase !== 'Closed' && d.sale_price)
    .slice(0, 4)

  const buyerLeads = leads
    .filter((l) => l.interest_type === 'Buying' && (l.budget_min || l.budget_max) && !l.converted_to_deal_id)
    .slice(0, 4)

  if (buyerDeals.length === 0 && buyerLeads.length === 0) {
    return (
      <Section eyebrow="Personal" title="Your Deal Signals" subtitle="Personalized rate impact for your active buyer deals and leads.">
        <p className="card p-5 text-muted text-sm">
          No active buyer deals or leads with budget data — add some to see personalized signals here.
        </p>
      </Section>
    )
  }

  return (
    <Section eyebrow="Personal" title="Your Deal Signals" subtitle="Personalized rate impact at the current 30-year fixed.">
      <div className="space-y-3">
        {buyerDeals.map((d) => {
          const m = monthlyPayment(d.sale_price, 20, cur.value)
          const mPlus50bps = monthlyPayment(d.sale_price, 20, cur.value + 0.5)
          return (
            <div key={d.id} className="card p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Buyer deal</p>
              <p className="font-display text-lg font-bold text-navy mt-0.5 leading-tight truncate">
                {d.buyer_name || 'Buyer'} · {d.address}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Metric label={`At ${cur.value.toFixed(2)}%`} value={`${formatCurrency(m)}/mo`} />
                <Metric label={`If +0.5% before lock`} value={`+${formatCurrency(mPlus50bps - m)}/mo`} tone="red" />
              </div>
              <p className="text-muted text-xs mt-3">
                {formatCurrency(d.sale_price)} · 20% down assumed · 30-year fixed
              </p>
            </div>
          )
        })}

        {buyerLeads.map((l) => {
          const budget = l.budget_max || l.budget_min
          // Approximate: assume 25% of budget covers monthly housing — translates
          // to a rough purchase ceiling at the current rate.
          const monthlyTarget = (budget || 0) * 0.005
          const power = purchasePowerFromBudget(monthlyTarget, cur.value, 20)
          return (
            <div key={l.id} className="card p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Buyer lead</p>
              <p className="font-display text-lg font-bold text-navy mt-0.5 leading-tight truncate">
                {l.first_name} {l.last_name}
              </p>
              <p className="text-muted text-xs mt-1">
                Budget {formatCurrency(budget)} · Target area {l.target_area || '—'}
              </p>
              <p className="text-navy text-sm mt-3">
                At {cur.value.toFixed(2)}%, supports a ~<span className="font-bold text-gold-dark">{formatCurrency(power)}</span> purchase price (rough)
              </p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function Metric({ label, value, tone = 'navy' }) {
  const cls = {
    navy: 'text-navy',
    red: 'text-red-600',
    green: 'text-green-600',
  }[tone]
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</p>
      <p className={`font-display text-lg font-bold mt-0.5 ${cls}`}>{value}</p>
    </div>
  )
}

// ─────────────────────────── 3. Market Pulse ───────────────────────────
function MarketPulse({ mortgage, fedFunds, caseShiller, unemployment }) {
  return (
    <Section eyebrow="Pulse" title="Market Pulse" subtitle="Macro signals from public data.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <PulseCard
          label="30-yr Mortgage"
          series={mortgage?.series}
          err={mortgage?.error}
          unit="%"
          comparePeriods={4}
          comparePeriodLabel="4 weeks"
          goodOnDown
        />
        <PulseCard
          label="Fed Funds Rate"
          series={fedFunds?.series}
          err={fedFunds?.error}
          unit="%"
          comparePeriods={1}
          comparePeriodLabel="month"
        />
        <PulseCard
          label="Case-Shiller HPI"
          series={caseShiller?.series}
          err={caseShiller?.error}
          unit=""
          comparePeriods={1}
          comparePeriodLabel="month"
          goodOnUp
        />
        <PulseCard
          label="US Unemployment"
          series={unemployment?.series}
          err={unemployment?.error}
          unit="%"
          comparePeriods={1}
          comparePeriodLabel="month"
          goodOnDown
        />
      </div>
    </Section>
  )
}

function PulseCard({ label, series, err, unit, comparePeriods, comparePeriodLabel, goodOnDown, goodOnUp }) {
  if (err || !series || series.length === 0) {
    return (
      <div className="card p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-muted text-xs mt-2">Data unavailable.</p>
      </div>
    )
  }
  const cur = latest(series)
  const change = changeFromN(series, comparePeriods)

  let direction = 'stable'
  if (change && Math.abs(change.delta) > 0.01) direction = change.delta > 0 ? 'rising' : 'falling'
  const isGood = (goodOnDown && direction === 'falling') || (goodOnUp && direction === 'rising')
  const isBad = (goodOnDown && direction === 'rising') || (goodOnUp && direction === 'falling')
  const tone = isGood ? 'bg-green-500' : isBad ? 'bg-red-500' : 'bg-amber-400'
  const directionLabel = direction === 'rising' ? 'Rising' : direction === 'falling' ? 'Falling' : 'Stable'

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <span className={`w-2 h-2 rounded-full ${tone}`} />
      </div>
      <p className="font-display text-3xl font-bold text-navy mt-2 leading-none">
        {cur.value.toFixed(unit === '%' ? 2 : 1)}{unit}
      </p>
      <p className="text-xs text-muted mt-2">
        {directionLabel} · {comparePeriodLabel} · {change ? `${change.delta >= 0 ? '+' : ''}${change.delta.toFixed(2)}` : '—'}
      </p>
    </div>
  )
}

// ─────────────────────────── 4. Agent-specific insights ───────────────────────────
function AgentInsights({ deals, leads, mortgage, caseShiller }) {
  const navigate = useNavigate()
  const { setOpen } = useQuickLog()
  const series = mortgage?.series || []

  // RATE ALERT: any 0.25%+ move in last 2 weeks
  const twoWeekChange = changeWeeksAgo(series, 2)
  const rateAlert = twoWeekChange && Math.abs(twoWeekChange.delta) >= 0.25
    ? twoWeekChange : null
  const buyerDeals = deals.filter((d) => d.agent_role === 'buyer' && d.phase !== 'Closed')

  // PAST CLIENT REFI: current rate < 12 months ago
  const yearAgoChange = changeWeeksAgo(series, 52)
  const refiOpportunity = yearAgoChange && yearAgoChange.delta < -0.25 ? yearAgoChange : null
  const closedDeals = deals.filter((d) => d.phase === 'Closed')

  // MARKET MOMENTUM: Case-Shiller +2% in last 3 months
  const csChange = changeFromN(caseShiller?.series || [], 3)
  const momentum = csChange && csChange.pct >= 0.02 ? csChange : null
  const sellerDeals = deals.filter((d) => d.agent_role === 'seller' && d.phase !== 'Closed')

  // BUYER URGENCY: rates rising AND home prices rising
  const urgency = rateAlert && rateAlert.delta > 0 && csChange && csChange.delta > 0
  const warmHotLeads = leads.filter((l) =>
    !l.converted_to_deal_id && l.interest_type === 'Buying' && (l.temperature === 'Hot' || l.temperature === 'Warm')
  )

  const insights = []
  if (rateAlert && buyerDeals.length > 0) {
    insights.push({
      key: 'rate',
      tone: 'gold',
      title: 'Rates moved — check buyer locks',
      body: `Rates moved ${rateAlert.delta >= 0 ? '+' : ''}${rateAlert.delta.toFixed(2)}% in the last 2 weeks. You have ${buyerDeals.length} buyer ${buyerDeals.length === 1 ? 'deal' : 'deals'} active. Consider reaching out to confirm they've locked their rate.`,
      action: { type: 'list-deals', deals: buyerDeals },
    })
  }
  if (refiOpportunity && closedDeals.length > 0) {
    insights.push({
      key: 'refi',
      tone: 'green',
      title: 'Refi opportunity for past clients',
      body: `Current rates are ${Math.abs(yearAgoChange.delta).toFixed(2)}% lower than this time last year. ${closedDeals.length} of your past clients bought when rates were higher — they may benefit from refinancing or selling.`,
      action: { type: 'list-deals', deals: closedDeals.slice(0, 5) },
    })
  }
  if (momentum && sellerDeals.length > 0) {
    insights.push({
      key: 'momentum',
      tone: 'gold',
      title: 'Listings have pricing room',
      body: `Home prices rose ${(momentum.pct * 100).toFixed(1)}% in the last 3 months. Your ${sellerDeals.length} active ${sellerDeals.length === 1 ? 'listing' : 'listings'} may have pricing room — worth discussing with sellers.`,
      action: { type: 'list-deals', deals: sellerDeals },
    })
  }
  if (urgency && warmHotLeads.length > 0) {
    insights.push({
      key: 'urgency',
      tone: 'red',
      title: 'Buyer urgency conditions',
      body: `Rising rates + rising prices — classic urgency conditions. Your ${warmHotLeads.length} warm/hot buyer ${warmHotLeads.length === 1 ? 'lead' : 'leads'} may benefit from a nudge.`,
      action: { type: 'list-leads', leads: warmHotLeads },
    })
  }

  return (
    <Section eyebrow="Personalized" title="Agent-Specific Insights" subtitle="Patterns combining your data with the market.">
      {insights.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="text-navy font-semibold">No actionable signals right now.</p>
          <p className="text-muted text-xs mt-1">Insights appear when rates, prices, and your pipeline line up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((ins) => (
            <InsightCard
              key={ins.key}
              insight={ins}
              onLogCall={() => setOpen(true)}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function InsightCard({ insight, onLogCall, navigate }) {
  const accent = {
    gold: 'border-l-gold',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
  }[insight.tone] || 'border-l-navy'

  return (
    <div className={`card p-5 border-l-4 ${accent}`}>
      <h3 className="font-display text-lg font-bold text-navy leading-tight">{insight.title}</h3>
      <p className="text-navy/80 text-sm mt-2 leading-relaxed">{insight.body}</p>

      {insight.action?.type === 'list-deals' && (
        <ul className="mt-3 space-y-1">
          {insight.action.deals.slice(0, 5).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <button
                onClick={() => navigate(`/deals/${d.id}`)}
                className="text-navy font-medium hover:text-gold-dark transition-colors text-left truncate flex-1"
              >
                {d.address}
              </button>
              <button
                onClick={onLogCall}
                className="bg-gold/15 hover:bg-gold/25 text-gold-dark text-xs font-bold rounded-lg px-2.5 h-7 flex items-center gap-1 transition-colors shrink-0"
              >
                <BoltIcon className="w-3 h-3" />
                Log
              </button>
            </li>
          ))}
        </ul>
      )}

      {insight.action?.type === 'list-leads' && (
        <ul className="mt-3 space-y-1">
          {insight.action.leads.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <button
                onClick={() => navigate(`/leads/${l.id}/edit`)}
                className="text-navy font-medium hover:text-gold-dark transition-colors text-left truncate flex-1"
              >
                {l.first_name} {l.last_name} <span className="text-muted text-xs">· {l.temperature}</span>
              </button>
              {l.phone && (
                <a
                  href={`tel:${l.phone}`}
                  className="bg-gold/15 hover:bg-gold/25 text-gold-dark text-xs font-bold rounded-lg px-2.5 h-7 flex items-center transition-colors shrink-0"
                >
                  Call
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────── 5. Fed Calendar ───────────────────────────
function FedCalendar() {
  const next = nextFedMeeting()
  return (
    <Section eyebrow="Fed" title="FOMC Calendar 2026" subtitle="Federal Reserve rate-decision meetings.">
      <div className="card overflow-hidden">
        <ul className="divide-y divide-navy/[0.05]">
          {FED_MEETINGS_2026.map((iso) => {
            const isNext = iso === next
            const isPast = iso < new Date().toISOString().split('T')[0]
            const date = parseISO(iso)
            return (
              <li
                key={iso}
                className={`flex items-center justify-between gap-3 px-5 py-4 ${
                  isNext ? 'bg-gold/[0.06] border-l-4 border-l-gold' : isPast ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isNext ? 'bg-gold text-navy' : 'bg-navy/[0.04] text-navy/70'
                  }`}>
                    <CalendarIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-navy text-sm">{format(date, 'EEEE, MMMM d, yyyy')}</p>
                    <p className="text-muted text-xs">Rate decision expected</p>
                  </div>
                </div>
                {isNext && (
                  <span className="badge-pill bg-gold text-navy">Next up</span>
                )}
                {isPast && !isNext && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Past</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}

// ─────────────────────────── Shared ───────────────────────────
function Section({ eyebrow, title, subtitle, children }) {
  return (
    <section>
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        <h2 className="font-display text-2xl font-bold text-navy mt-0.5 leading-tight">{title}</h2>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Unavailable() {
  return (
    <div className="card p-5 text-center">
      <BarChartIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
      <p className="text-navy font-semibold">Market data temporarily unavailable</p>
      <p className="text-muted text-xs mt-1">Check back later.</p>
    </div>
  )
}
