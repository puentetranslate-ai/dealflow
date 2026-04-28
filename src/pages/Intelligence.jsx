import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, parseISO, startOfWeek, startOfMonth, startOfYear, endOfMonth,
  subMonths, addDays, isWithinInterval, differenceInMonths, differenceInYears,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, calcCommission, formatDate } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import CommissionTracker from './CommissionTracker'
import { ArrowRightIcon, BarChartIcon, CopyIcon, CheckIcon, UserPlusIcon } from '../components/Icon'

const TABS = [
  { id: 'commission', label: 'Commission' },
  { id: 'insights', label: 'Insights' },
]

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
]

export default function Intelligence() {
  const [tab, setTab] = useState('commission')

  return (
    <AppLayout>
      <MobileHeader eyebrow="HUB" title="Intelligence" showBell />
      <TopBar />

      <div className="hidden md:block px-8 pt-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Hub</p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">Intelligence</h1>
      </div>

      {/* Tabs */}
      <div className="px-5 md:px-8">
        <div className="flex items-center gap-1 border-b border-navy/[0.06]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.id ? 'text-navy' : 'text-muted hover:text-navy'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'commission' && <CommissionTracker />}
      {tab === 'insights' && <InsightsTab />}
    </AppLayout>
  )
}

// ─────────────────────────── Insights tab ───────────────────────────
function InsightsTab() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('deals').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('leads').select('*').eq('user_id', user.id),
    ]).then(([dealsRes, leadsRes]) => {
      if (cancelled) return
      setDeals(dealsRes.data || [])
      setLeads(leadsRes.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="px-5 md:px-8 pt-5 pb-32 md:pb-12 space-y-6">
      <EarningsOverview deals={deals} period={period} setPeriod={setPeriod} />
      <CareerTotals deals={deals} />
      <PipelineProjections deals={deals} />
      <PastClientReengagement deals={deals} navigate={navigate} userId={user.id} />
      <SourcePerformance leads={leads} deals={deals} />
    </div>
  )
}

// ─────────────────────────── Section 1: Earnings Overview ───────────────────────────
function EarningsOverview({ deals, period, setPeriod }) {
  const closedDeals = deals.filter((d) => d.phase === 'Closed')

  const periodFilter = useMemo(() => {
    const now = new Date()
    if (period === 'week') return { start: startOfWeek(now), end: now }
    if (period === 'month') return { start: startOfMonth(now), end: now }
    if (period === 'year') return { start: startOfYear(now), end: now }
    return null
  }, [period])

  const inPeriod = useMemo(() => {
    if (!periodFilter) return closedDeals
    return closedDeals.filter((d) => {
      const dateStr = d.closing_date || d.created_at
      if (!dateStr) return false
      try {
        const dt = typeof dateStr === 'string' && dateStr.includes('T')
          ? new Date(dateStr)
          : parseISO(dateStr)
        return isWithinInterval(dt, periodFilter)
      } catch { return false }
    })
  }, [closedDeals, periodFilter])

  const totalSales = inPeriod.reduce((s, d) => s + (Number(d.sale_price) || 0), 0)
  const totalCommission = inPeriod.reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
  const avgCommission = inPeriod.length ? totalCommission / inPeriod.length : 0

  // 12-month chart data
  const monthly = useMemo(() => {
    const out = []
    const monthStart = startOfMonth(new Date())
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(monthStart, i)
      out.push({ key: format(d, 'yyyy-MM'), date: d, label: format(d, 'MMM'), earned: 0, projected: 0 })
    }
    const idxOf = (k) => out.findIndex((m) => m.key === k)
    closedDeals.forEach((d) => {
      const date = d.closing_date || d.created_at
      if (!date) return
      try {
        const k = format(parseISO(date), 'yyyy-MM')
        const i = idxOf(k)
        if (i >= 0) out[i].earned += calcCommission(d.sale_price, d.commission_pct)
      } catch {}
    })
    deals.filter((d) => d.phase !== 'Closed' && d.closing_date).forEach((d) => {
      try {
        const k = format(parseISO(d.closing_date), 'yyyy-MM')
        const i = idxOf(k)
        if (i >= 0) out[i].projected += calcCommission(d.sale_price, d.commission_pct)
      } catch {}
    })
    return out
  }, [deals, closedDeals])

  const peak = monthly.reduce((m, c) => Math.max(m, c.earned + c.projected), 0)
  const peakIdx = monthly.findIndex((m) => m.earned + m.projected === peak && peak > 0)
  const currentKey = format(new Date(), 'yyyy-MM')

  return (
    <section>
      <SectionHeader
        eyebrow="Earnings"
        title="Earnings Overview"
        subtitle="How you're performing in the selected window."
      />

      {/* Period toggle */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`shrink-0 px-3.5 h-9 rounded-full text-xs font-semibold transition-colors ${
              period === p.id
                ? 'bg-navy text-white'
                : 'bg-white text-navy/70 border border-navy/10 hover:border-navy/30'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Stat label="Total Sales Volume" value={formatCurrency(totalSales)} />
        <Stat label="Commission Earned" value={formatCurrency(totalCommission)} tone="green" />
        <Stat label="Deals Closed" value={inPeriod.length} />
        <Stat label="Average Commission" value={formatCurrency(avgCommission)} tone="gold" />
      </div>

      {/* Chart */}
      <div className="card p-5 md:p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-title mb-0">Monthly Commission</p>
            <p className="text-navy font-semibold text-sm mt-1">Last 12 months</p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] text-muted">
            <Legend dot="bg-navy" label="Earned" />
            <Legend dot="bg-gold" label="Current" />
            <Legend dot="bg-gold/40" label="Projected" />
          </div>
        </div>
        <BarChart months={monthly} peak={peak} peakIdx={peakIdx} currentKey={currentKey} />
      </div>
    </section>
  )
}

function BarChart({ months, peak, peakIdx, currentKey }) {
  const max = Math.max(peak, 1)
  return (
    <div>
      <div className="relative h-44 md:h-56 flex items-end gap-1.5 md:gap-3">
        {months.map((m, i) => {
          const isCurrent = m.key === currentKey
          const isFuture = m.date > new Date() && !isCurrent
          const total = m.earned + m.projected
          const earnedPct = (m.earned / max) * 100
          const projectedPct = (m.projected / max) * 100
          const isPeak = i === peakIdx && total > 0
          return (
            <div key={m.key} className="flex-1 h-full flex flex-col justify-end relative">
              {isPeak && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gold-dark whitespace-nowrap">
                  {formatCurrency(total)}
                </div>
              )}
              <div className="w-full flex flex-col rounded-t-md overflow-hidden">
                {m.projected > 0 && (
                  <div
                    className={`bg-gold/40 ${isFuture ? 'border-2 border-dashed border-gold/60' : ''}`}
                    style={{ height: `${projectedPct * 1.4}px` }}
                  />
                )}
                <div
                  className={`${isCurrent ? 'bg-gradient-to-t from-gold to-gold-light' : 'bg-navy'} transition-all`}
                  style={{ height: `${earnedPct * 1.4}px` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 md:gap-3 mt-2">
        {months.map((m) => (
          <div key={m.key} className="flex-1 text-center text-[10px] md:text-xs text-muted font-medium">
            {m.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend({ dot, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${dot}`} />
      {label}
    </span>
  )
}

// ─────────────────────────── Section 2: Career Totals ───────────────────────────
function CareerTotals({ deals }) {
  const closed = deals.filter((d) => d.phase === 'Closed')
  const careerSales = closed.reduce((s, d) => s + (Number(d.sale_price) || 0), 0)
  const careerCommission = closed.reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
  const avgPrice = closed.length ? careerSales / closed.length : 0

  const firstDealDate = deals.length
    ? deals.reduce((min, d) => {
        const dt = d.created_at ? new Date(d.created_at) : null
        if (!dt) return min
        return !min || dt < min ? dt : min
      }, null)
    : null
  const yearsActive = firstDealDate
    ? Math.max(0, differenceInYears(new Date(), firstDealDate))
    : 0
  const monthsActive = firstDealDate
    ? Math.max(0, differenceInMonths(new Date(), firstDealDate))
    : 0
  const yearsLabel = monthsActive < 12
    ? `${monthsActive} ${monthsActive === 1 ? 'month' : 'months'}`
    : `${yearsActive} ${yearsActive === 1 ? 'year' : 'years'}`

  // Best month ever
  const monthMap = {}
  closed.forEach((d) => {
    const date = d.closing_date || d.created_at
    if (!date) return
    try {
      const k = format(parseISO(date), 'yyyy-MM')
      monthMap[k] = (monthMap[k] || 0) + calcCommission(d.sale_price, d.commission_pct)
    } catch {}
  })
  let bestMonth = null
  let bestAmount = 0
  Object.entries(monthMap).forEach(([k, v]) => {
    if (v > bestAmount) { bestAmount = v; bestMonth = k }
  })
  const bestMonthLabel = bestMonth
    ? `${formatCurrency(bestAmount)} · ${format(parseISO(`${bestMonth}-01`), 'MMM yyyy')}`
    : '—'

  return (
    <section>
      <SectionHeader eyebrow="Career" title="Career Totals" subtitle="Lifetime stats across your entire DealFlow history." />

      <div className="bg-navy text-white rounded-2xl p-5 md:p-7 relative overflow-hidden shadow-pop">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -translate-y-16 translate-x-12 pointer-events-none" />
        <div className="relative grid grid-cols-2 md:grid-cols-3 gap-5 md:gap-6">
          <CareerStat label="Career Sales Volume" value={formatCurrency(careerSales)} tone="white" />
          <CareerStat label="Career Commission" value={formatCurrency(careerCommission)} tone="gold" />
          <CareerStat label="Total Deals Closed" value={closed.length} tone="white" />
          <CareerStat label="Years Active" value={yearsLabel} tone="white" />
          <CareerStat label="Avg Sale Price" value={formatCurrency(avgPrice)} tone="white" />
          <CareerStat label="Best Month Ever" value={bestMonthLabel} tone="gold" small />
        </div>
      </div>
    </section>
  )
}

function CareerStat({ label, value, tone, small }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gold/80">{label}</p>
      <p className={`font-display ${small ? 'text-base md:text-lg' : 'text-xl md:text-2xl'} font-bold mt-1 leading-tight ${
        tone === 'gold' ? 'text-gold' : 'text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

// ─────────────────────────── Section 3: Pipeline Projections ───────────────────────────
function PipelineProjections({ deals }) {
  const today = new Date()
  const open = deals.filter((d) => d.phase !== 'Closed')

  const within = (days) => {
    const end = addDays(today, days)
    return open.filter((d) => {
      if (!d.closing_date) return false
      try { return isWithinInterval(parseISO(d.closing_date), { start: today, end }) } catch { return false }
    })
  }

  const projections = [
    { label: 'Next 30 days', deals: within(30) },
    { label: 'Next 60 days', deals: within(60) },
    { label: 'Next 90 days', deals: within(90) },
  ]

  return (
    <section>
      <SectionHeader eyebrow="Pipeline" title="Projections" subtitle="Commission tied to deals scheduled to close ahead." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {projections.map(({ label, deals: list }) => {
          const sum = list.reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
          return (
            <div key={label} className="card p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
              <p className="font-display text-3xl font-bold text-gold-dark mt-2 leading-none">
                {formatCurrency(sum)}
              </p>
              <p className="text-xs text-muted mt-2">
                {list.length} {list.length === 1 ? 'deal' : 'deals'} closing
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────── Section 4: Past Client Re-engagement ───────────────────────────
function PastClientReengagement({ deals, navigate, userId }) {
  const reengagement = useMemo(() => {
    const today = new Date()
    return deals
      .filter((d) => d.phase === 'Closed' && d.closing_date)
      .map((d) => {
        try {
          const months = differenceInMonths(today, parseISO(d.closing_date))
          return { deal: d, months }
        } catch { return null }
      })
      .filter((r) => r && r.months >= 24 && r.months <= 48)
      .sort((a, b) => a.months - b.months)
  }, [deals])

  return (
    <section>
      <SectionHeader
        eyebrow="Re-engagement"
        title="Past Clients to Re-engage"
        subtitle="Based on typical resale timing, these past clients may be ready to hear from you."
      />

      {reengagement.length === 0 ? (
        <div className="card text-center py-10 px-4">
          <p className="text-navy font-semibold">No re-engagement opportunities right now.</p>
          <p className="text-muted text-sm mt-1">Check back as your closed deals age.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reengagement.map((r) => (
            <ReengagementCard
              key={r.deal.id}
              deal={r.deal}
              months={r.months}
              userId={userId}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ReengagementCard({ deal, months, userId, navigate }) {
  const [copied, setCopied] = useState(false)
  const [logging, setLogging] = useState(false)

  // Past client identity depends on which side we represented.
  const repBuyer = deal.agent_role === 'buyer'
  const clientName = repBuyer ? deal.buyer_name : deal.seller_name
  const clientPhone = repBuyer ? deal.buyer_phone : deal.seller_phone
  const clientEmail = repBuyer ? deal.buyer_email : deal.seller_email
  const firstName = (clientName || '').split(/\s+/)[0] || 'there'

  const timeAgo = months >= 36
    ? `${Math.floor(months / 12)} years`
    : months >= 12
    ? `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'}, ${months % 12} months`
    : `${months} months`

  const message = `Hi ${firstName}, it's been ${timeAgo} since we closed on ${deal.address}. I wanted to check in and see how you're enjoying the home. The market in your area has been active — happy to share an update anytime. Hope all is well!`

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(message) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = message
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Past buyer is more likely to be a future seller of their current home;
  // past seller is more likely to be a future buyer. Best smart default.
  const handleLogAsLead = async () => {
    if (!clientName) return
    setLogging(true)
    const parts = clientName.trim().split(/\s+/)
    const firstNameField = parts[0] || ''
    const lastName = parts.slice(1).join(' ') || '(unknown)'
    const interest_type = repBuyer ? 'Selling' : 'Buying'

    const { error } = await supabase.from('leads').insert({
      user_id: userId,
      first_name: firstNameField,
      last_name: lastName,
      phone: clientPhone || null,
      email: clientEmail || null,
      source: 'Past Client',
      temperature: 'Warm',
      interest_type,
      target_area: deal.address || null,
      notes: `Past client — closed ${formatDate(deal.closing_date)} on ${deal.address}. ${timeAgo} ago.`,
    })
    setLogging(false)
    if (!error) navigate('/leads')
  }

  if (!clientName) return null

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-navy leading-tight">{clientName}</h3>
          <p className="text-muted text-xs mt-0.5 truncate">{deal.address}</p>
        </div>
        <span className="badge-pill bg-gold/15 text-gold-dark shrink-0">
          {months}mo
        </span>
      </div>
      <p className="text-muted text-xs mt-2">
        Closed {formatDate(deal.closing_date)} · {timeAgo} ago
      </p>

      <div className="mt-4 bg-cream rounded-xl p-3 text-navy/80 text-xs leading-relaxed border border-navy/[0.04]">
        {message}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 rounded-xl min-h-[44px] text-sm font-semibold transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-gold hover:bg-gold-light text-navy'
          }`}
        >
          {copied ? (<><CheckIcon className="w-4 h-4" strokeWidth={2.5} />Copied!</>) : (<><CopyIcon className="w-4 h-4" />Copy Message</>)}
        </button>
        <button
          onClick={handleLogAsLead}
          disabled={logging}
          className="flex items-center justify-center gap-2 bg-navy/[0.04] hover:bg-navy/[0.08] text-navy rounded-xl min-h-[44px] text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {logging ? <LoadingSpinner size="sm" /> : (<><UserPlusIcon className="w-4 h-4" />Log as Lead</>)}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────── Section 5: Source Performance ───────────────────────────
function SourcePerformance({ leads, deals }) {
  const dealsById = useMemo(() => {
    const map = {}
    deals.forEach((d) => { map[d.id] = d })
    return map
  }, [deals])

  const stats = useMemo(() => {
    const map = {}
    leads.forEach((l) => {
      const key = l.source === 'Referral' && l.referrer_name
        ? `Referral · ${l.referrer_name}`
        : l.source || 'Other'
      if (!map[key]) map[key] = { source: key, total: 0, converted: 0, commission: 0 }
      map[key].total++
      if (l.converted_to_deal_id) {
        map[key].converted++
        const deal = dealsById[l.converted_to_deal_id]
        if (deal) map[key].commission += calcCommission(deal.sale_price, deal.commission_pct)
      }
    })
    return Object.values(map)
      .map((s) => ({ ...s, rate: s.total ? Math.round((s.converted / s.total) * 100) : 0 }))
      .sort((a, b) => b.commission - a.commission || b.total - a.total)
  }, [leads, dealsById])

  return (
    <section>
      <SectionHeader eyebrow="Sources" title="Source Performance" subtitle="Where your earnings actually come from." />

      {stats.length === 0 ? (
        <div className="card text-center py-10 px-4">
          <BarChartIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
          <p className="text-navy font-semibold">No source data yet</p>
          <p className="text-muted text-sm mt-1">Add leads to see source performance.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Leads</th>
                  <th className="px-5 py-3 text-right">Converted</th>
                  <th className="px-5 py-3 text-right">Conv. Rate</th>
                  <th className="px-5 py-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/[0.05]">
                {stats.map((s, i) => (
                  <tr key={s.source} className="hover:bg-cream/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-navy/[0.04] text-navy text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-navy">{s.source}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-navy">{s.total}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold">{s.converted}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-bold ${
                        s.rate >= 30 ? 'text-green-600' : s.rate >= 15 ? 'text-gold-dark' : 'text-muted'
                      }`}>{s.rate}%</span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gold-dark">
                      {formatCurrency(s.commission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

// ─────────────────────────── Shared sub-components ───────────────────────────
function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
      <h2 className="font-display text-2xl font-bold text-navy mt-0.5 leading-tight">{title}</h2>
      {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
    </div>
  )
}

function Stat({ label, value, tone = 'navy' }) {
  const toneClass = {
    navy: 'text-navy',
    gold: 'text-gold-dark',
    green: 'text-green-600',
  }[tone]
  return (
    <div className="card p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-display text-2xl md:text-3xl font-bold mt-2 leading-none ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}
