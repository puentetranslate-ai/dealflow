import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subMonths, startOfMonth, parseISO, addDays, isWithinInterval } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate, calcCommission } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { ArrowRightIcon, DollarIcon } from '../components/Icon'

export default function CommissionTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('open') // open | closed
  const [sort, setSort] = useState('date_asc')

  useEffect(() => {
    supabase
      .from('deals')
      .select('id, address, sale_price, commission_pct, phase, closing_date, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || [])
        setLoading(false)
      })
  }, [user.id])

  const openDeals = deals.filter((d) => d.phase !== 'Closed')
  const closedDeals = deals.filter((d) => d.phase === 'Closed')

  const pendingTotal = openDeals.reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
  const earnedTotal = closedDeals.reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
  const avgPerDeal = openDeals.length ? pendingTotal / openDeals.length : 0

  // Projected by closing date — used for desktop "next 30/60/90"
  const today = new Date()
  const projection = useMemo(() => {
    const within = (days) =>
      openDeals
        .filter(
          (d) =>
            d.closing_date &&
            isWithinInterval(parseISO(d.closing_date), {
              start: today,
              end: addDays(today, days),
            })
        )
        .reduce((s, d) => s + calcCommission(d.sale_price, d.commission_pct), 0)
    return { d30: within(30), d60: within(60), d90: within(90) }
  }, [openDeals])

  // 12-month series. Closed deals slot into the month their closing_date falls in
  // (falling back to created month if no closing_date). Future months show as projected.
  const monthly = useMemo(() => {
    const months = []
    const monthStart = startOfMonth(today)
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(monthStart, i)
      months.push({ key: format(d, 'yyyy-MM'), date: d, label: format(d, 'MMM'), earned: 0, projected: 0 })
    }
    const idx = (k) => months.findIndex((m) => m.key === k)

    closedDeals.forEach((d) => {
      const date = d.closing_date || d.created_at
      if (!date) return
      const k = format(parseISO(date), 'yyyy-MM')
      const i = idx(k)
      if (i >= 0) months[i].earned += calcCommission(d.sale_price, d.commission_pct)
    })

    // Projection: open deals with future closing_date
    openDeals.forEach((d) => {
      if (!d.closing_date) return
      const k = format(parseISO(d.closing_date), 'yyyy-MM')
      const i = idx(k)
      if (i >= 0) months[i].projected += calcCommission(d.sale_price, d.commission_pct)
    })

    return months
  }, [closedDeals, openDeals])

  const peak = useMemo(() =>
    monthly.reduce((m, c) => Math.max(m, c.earned + c.projected), 0)
  , [monthly])
  const peakIdx = monthly.findIndex((m) => m.earned + m.projected === peak)
  const currentKey = format(today, 'yyyy-MM')

  // Sorted rows
  const visibleRows = useMemo(() => {
    const rows = view === 'open' ? openDeals : closedDeals
    const arr = [...rows]
    if (sort === 'date_asc') {
      arr.sort((a, b) => {
        const da = a.closing_date ? new Date(a.closing_date).getTime() : Infinity
        const db = b.closing_date ? new Date(b.closing_date).getTime() : Infinity
        return da - db
      })
    } else if (sort === 'amount_desc') {
      arr.sort((a, b) => calcCommission(b.sale_price, b.commission_pct) - calcCommission(a.sale_price, a.commission_pct))
    }
    return arr
  }, [view, sort, openDeals, closedDeals])

  return (
    <AppLayout>
      <MobileHeader eyebrow="TRACKER" title="Commission" showBell />
      <TopBar />

      <div className="hidden md:block px-8 pt-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Tracker</p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">Commission</h1>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-5">
              {/* Pending */}
              <div className="relative bg-navy text-white rounded-2xl p-5 md:p-6 overflow-hidden shadow-pop">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full -translate-y-12 translate-x-10 pointer-events-none" />
                <p className="text-gold text-xs font-bold uppercase tracking-wider relative">Total Pending</p>
                <p className="font-display text-3xl md:text-5xl font-bold text-gold mt-2 leading-none relative">
                  {formatCurrency(pendingTotal)}
                </p>
                <p className="text-white/70 text-xs mt-2 relative">
                  Avg <span className="font-semibold text-white">{formatCurrency(avgPerDeal)}</span> per deal
                </p>
                <div className="hidden md:grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/[0.08] relative">
                  <Projection label="30d" value={projection.d30} />
                  <Projection label="60d" value={projection.d60} />
                  <Projection label="90d" value={projection.d90} />
                </div>
                <p className="md:hidden text-white/60 text-xs mt-3 relative">
                  {openDeals.length} open {openDeals.length === 1 ? 'deal' : 'deals'}
                </p>
              </div>

              {/* Earned YTD */}
              <div className="card p-5 md:p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Earned YTD</p>
                <p className="font-display text-3xl md:text-5xl font-bold text-green-600 mt-2 leading-none">
                  {formatCurrency(earnedTotal)}
                </p>
                <p className="text-muted text-xs mt-2">
                  {closedDeals.length} closed {closedDeals.length === 1 ? 'deal' : 'deals'}
                </p>
                <button
                  className="hidden md:inline-flex mt-4 items-center gap-1 text-xs font-semibold text-gold-dark hover:text-gold transition-colors"
                  onClick={() => alert('Tax report export coming soon.')}
                >
                  View tax report
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Bar chart ── */}
            <div className="card p-5 md:p-6 mt-4 md:mt-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-title mb-0">Monthly Commission</p>
                  <p className="text-navy font-semibold text-sm mt-1">Last 12 months</p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs">
                  <Legend dotClass="bg-navy" label="Earned" />
                  <Legend dotClass="bg-gold" label="Current" />
                  <Legend dotClass="bg-gold/40 ring-2 ring-gold ring-offset-2 ring-offset-white" label="Projected" />
                </div>
              </div>

              <BarChart months={monthly} peak={peak} peakIdx={peakIdx} currentKey={currentKey} />
            </div>

            {/* ── Open / Closed toggle ── */}
            <div className="flex items-center justify-between mt-6 mb-3">
              <div className="flex bg-white border border-navy/10 rounded-full p-1">
                <ToggleTab active={view === 'open'} onClick={() => setView('open')}>
                  Open <span className="opacity-60 ml-0.5">{openDeals.length}</span>
                </ToggleTab>
                <ToggleTab active={view === 'closed'} onClick={() => setView('closed')}>
                  Closed <span className="opacity-60 ml-0.5">{closedDeals.length}</span>
                </ToggleTab>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-semibold text-navy bg-white border border-navy/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/30"
              >
                <option value="date_asc">Closing soonest</option>
                <option value="amount_desc">Highest amount</option>
              </select>
            </div>

            {visibleRows.length === 0 ? (
              <div className="card text-center py-12">
                <DollarIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
                <p className="text-navy font-semibold">
                  No {view === 'open' ? 'open' : 'closed'} deals
                </p>
                <p className="text-muted text-sm mt-1">
                  {view === 'open'
                    ? 'Add a deal to start tracking pending commission.'
                    : 'Close a deal to see earnings here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleRows.map((deal) => (
                  <CommissionRow
                    key={deal.id}
                    deal={deal}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    closed={view === 'closed'}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─────────────────────────── Bar chart ───────────────────────────
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
              {/* Peak label */}
              {isPeak && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gold-dark whitespace-nowrap">
                  {formatCurrency(total)}
                </div>
              )}

              <div className="w-full flex flex-col rounded-t-md overflow-hidden">
                {/* Projected (top, dashed-ish gold) */}
                {m.projected > 0 && (
                  <div
                    className={`bg-gold/40 ${isFuture ? 'border-2 border-dashed border-gold/60' : ''}`}
                    style={{ height: `${projectedPct * 1.4}px` }}
                  />
                )}
                {/* Earned (bottom) */}
                <div
                  className={`${isCurrent ? 'bg-gradient-to-t from-gold to-gold-light' : 'bg-navy'} transition-all`}
                  style={{ height: `${earnedPct * 1.4}px` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {/* Month labels */}
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

function Legend({ dotClass, label }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className={`w-2.5 h-2.5 rounded-sm ${dotClass}`} />
      {label}
    </span>
  )
}

function Projection({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</p>
      <p className="font-semibold text-sm text-white mt-0.5">{formatCurrency(value)}</p>
    </div>
  )
}

function ToggleTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-8 rounded-full text-xs font-semibold transition-colors ${
        active ? 'bg-navy text-white' : 'text-navy/70 hover:text-navy'
      }`}
    >
      {children}
    </button>
  )
}

// ─────────────────────────── Row ───────────────────────────
function CommissionRow({ deal, onClick, closed }) {
  const commission = calcCommission(deal.sale_price, deal.commission_pct)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-hover w-full text-left p-4 md:p-5 border-l-4 ${
        closed ? 'border-l-green-500' : 'border-l-navy'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold text-navy leading-tight truncate">
            {deal.address}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <PhaseBadge phase={deal.phase} />
            <span className="text-xs text-muted">
              {formatCurrency(deal.sale_price)} × {deal.commission_pct || 0}%
            </span>
            {deal.closing_date && (
              <span className="text-xs text-muted">· {formatDate(deal.closing_date)}</span>
            )}
          </div>
        </div>
        <p className={`font-display text-xl md:text-2xl font-bold whitespace-nowrap shrink-0 ${
          closed ? 'text-green-600' : 'text-navy'
        }`}>
          {formatCurrency(commission)}
        </p>
      </div>
    </button>
  )
}
