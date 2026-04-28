import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TEMPERATURES, TEMP_STYLES } from '../lib/leadConstants'
import { formatCurrency, formatDate, isPastDue } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import LeadCard from '../components/LeadCard'
import Fab from '../components/Fab'
import {
  SearchIcon, PlusIcon, ArrowRightIcon, FunnelIcon, TrashIcon, XIcon,
} from '../components/Icon'

const VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'leads', label: 'Leads Only' },
  { id: 'clients', label: 'Clients Only' },
]

const TABS = [
  { id: 'list', label: 'Leads' },
  { id: 'sources', label: 'Sources' },
]

const SORTS = [
  { id: 'created_desc', label: 'Newest' },
  { id: 'follow_asc', label: 'Follow-up date' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'budget_desc', label: 'Budget (high to low)' },
]

const TEMP_SORT_RANK = { Hot: 0, Warm: 1, Cold: 2 }

export default function Leads() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all')
  const [tab, setTab] = useState('list')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created_desc')
  const [tempFilter, setTempFilter] = useState({ Hot: true, Warm: true, Cold: true })
  const [convertTarget, setConvertTarget] = useState(null) // lead pending convert confirm
  const [deletingId, setDeletingId] = useState(null)

  const fetchLeads = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [user.id])

  const totalCount = leads.length
  const tempCounts = useMemo(() => {
    const c = { Hot: 0, Warm: 0, Cold: 0 }
    leads.forEach((l) => { if (c[l.temperature] != null) c[l.temperature]++ })
    return c
  }, [leads])

  const filtered = useMemo(() => {
    let list = [...leads]

    // View toggle
    if (view === 'leads') list = list.filter((l) => !l.converted_to_deal_id)
    if (view === 'clients') list = list.filter((l) => l.converted_to_deal_id)

    // Temperature filter
    list = list.filter((l) => tempFilter[l.temperature] !== false)

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((l) =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.target_area?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q) ||
        l.referrer_name?.toLowerCase().includes(q)
      )
    }

    // Sort
    if (sort === 'follow_asc') {
      list.sort((a, b) => {
        const da = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity
        const db = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity
        return da - db
      })
    } else if (sort === 'temperature') {
      list.sort((a, b) => (TEMP_SORT_RANK[a.temperature] ?? 9) - (TEMP_SORT_RANK[b.temperature] ?? 9))
    } else if (sort === 'budget_desc') {
      list.sort((a, b) => (b.budget_max || b.budget_min || 0) - (a.budget_max || a.budget_min || 0))
    }

    return list
  }, [leads, view, tempFilter, search, sort])

  const handleConvertConfirm = async () => {
    if (!convertTarget) return
    const lead = convertTarget
    setConvertTarget(null)
    navigate(`/deals/new?fromLead=${lead.id}`)
  }

  const handleDelete = async (lead) => {
    if (!confirm(`Delete lead "${lead.first_name} ${lead.last_name}"? This cannot be undone.`)) return
    setDeletingId(lead.id)
    const { error } = await supabase.from('leads').delete().eq('id', lead.id).eq('user_id', user.id)
    setDeletingId(null)
    if (!error) setLeads((prev) => prev.filter((l) => l.id !== lead.id))
  }

  return (
    <AppLayout>
      {/* ── Mobile header ── */}
      <MobileHeader
        eyebrow="DIRECTORY"
        title={`Leads (${totalCount})`}
      >
        <div className="relative mt-4">
          <SearchIcon className="w-4 h-4 text-white/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full bg-white/[0.08] text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white/[0.14] transition-colors"
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-1 mt-3 bg-white/[0.08] rounded-xl p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                view === v.id ? 'bg-white text-navy' : 'text-white/60'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </MobileHeader>

      {/* ── Desktop top bar ── */}
      <TopBar search={search} onSearchChange={setSearch} searchPlaceholder="Search leads…" />

      {/* ── Desktop title row ── */}
      <div className="hidden md:flex items-center justify-between px-8 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Pipeline</p>
          <h1 className="font-display text-3xl font-bold text-navy mt-1">
            Leads <span className="text-muted font-medium">({totalCount})</span>
          </h1>
        </div>
        <button
          onClick={() => navigate('/leads/new')}
          className="bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-5 h-10 flex items-center gap-2 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* ── Tabs (Leads / Sources) ── */}
      <div className="px-5 md:px-8 pt-4">
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

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : tab === 'sources' ? (
          <SourcesTab leads={leads} />
        ) : (
          <>
            {/* Desktop view toggle */}
            <div className="hidden md:flex items-center justify-between mb-4">
              <div className="flex bg-white border border-navy/10 rounded-full p-1">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    className={`px-4 h-8 rounded-full text-xs font-semibold transition-colors ${
                      view === v.id ? 'bg-navy text-white' : 'text-navy/70 hover:text-navy'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-semibold text-navy bg-white border border-navy/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/30"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* Temperature filter pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar md:overflow-visible">
              {TEMPERATURES.map((temp) => {
                const style = TEMP_STYLES[temp]
                const active = tempFilter[temp]
                return (
                  <button
                    key={temp}
                    onClick={() => setTempFilter((f) => ({ ...f, [temp]: !f[temp] }))}
                    className={`shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold border-2 transition-colors ${
                      active
                        ? `${style.bg} ${style.text} ${style.border}`
                        : 'bg-white text-muted border-navy/10 hover:border-navy/20'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {temp} <span className="opacity-70 font-medium">{tempCounts[temp]}</span>
                  </button>
                )
              })}
            </div>

            {/* Mobile sort row */}
            <div className="md:hidden mb-3 flex items-center justify-between">
              <p className="text-muted text-xs">{filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}</p>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-semibold text-navy bg-white border border-navy/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/30"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <EmptyLeads
                hasAny={leads.length > 0}
                search={search}
                onAdd={() => navigate('/leads/new')}
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onView={() => navigate(`/leads/${lead.id}/edit`)}
                      onConvert={() => setConvertTarget(lead)}
                      onOpenDeal={() => navigate(`/deals/${lead.converted_to_deal_id}`)}
                    />
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Temperature</th>
                        <th className="px-5 py-3">Interest</th>
                        <th className="px-5 py-3">Source</th>
                        <th className="px-5 py-3">Budget</th>
                        <th className="px-5 py-3">Target Area</th>
                        <th className="px-5 py-3">Follow-up</th>
                        <th className="px-5 py-3">Phone</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy/[0.05]">
                      {filtered.map((lead) => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          onEdit={() => navigate(`/leads/${lead.id}/edit`)}
                          onConvert={() => setConvertTarget(lead)}
                          onOpenDeal={() => navigate(`/deals/${lead.converted_to_deal_id}`)}
                          onDelete={() => handleDelete(lead)}
                          deleting={deletingId === lead.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile FAB */}
      <Fab to="/leads/new" label="New Lead" />

      {/* Convert confirmation modal */}
      {convertTarget && (
        <ConvertModal
          lead={convertTarget}
          onConfirm={handleConvertConfirm}
          onCancel={() => setConvertTarget(null)}
        />
      )}
    </AppLayout>
  )
}

// ─────────────────────────── Desktop table row ───────────────────────────
function LeadRow({ lead, onEdit, onConvert, onOpenDeal, onDelete, deleting }) {
  const temp = TEMP_STYLES[lead.temperature] || TEMP_STYLES.Warm
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
  const isConverted = Boolean(lead.converted_to_deal_id)
  const overdue = lead.follow_up_date && isPastDue(lead.follow_up_date)
  const budget = formatBudgetShort(lead.budget_min, lead.budget_max)

  return (
    <tr className="hover:bg-cream/60 transition-colors">
      <td className="px-5 py-3">
        <button onClick={onEdit} className="flex items-center gap-3 text-left">
          <span className={`w-2 h-2 rounded-full ${temp.dot}`} />
          <span className="font-semibold text-navy">{fullName || 'Unnamed'}</span>
        </button>
      </td>
      <td className="px-5 py-3">
        <span className={`badge-pill ${temp.bg} ${temp.text}`}>{temp.label}</span>
      </td>
      <td className="px-5 py-3 text-navy/80">{lead.interest_type}</td>
      <td className="px-5 py-3 text-navy/80 max-w-[160px] truncate">
        {lead.source}
        {lead.source === 'Referral' && lead.referrer_name && (
          <span className="text-muted"> · {lead.referrer_name}</span>
        )}
      </td>
      <td className="px-5 py-3 text-navy/80 whitespace-nowrap">{budget}</td>
      <td className="px-5 py-3 text-navy/80 max-w-[160px] truncate">{lead.target_area || '—'}</td>
      <td className={`px-5 py-3 whitespace-nowrap ${overdue ? 'text-red-500 font-semibold' : 'text-navy/80'}`}>
        {lead.follow_up_date ? formatDate(lead.follow_up_date) : '—'}
      </td>
      <td className="px-5 py-3 text-navy/80 whitespace-nowrap">{lead.phone || '—'}</td>
      <td className="px-5 py-3">
        {isConverted ? (
          <span className="badge-pill bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Converted
          </span>
        ) : (
          <span className="badge-pill bg-gold/15 text-gold-dark">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Active
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="px-3 h-8 rounded-lg text-xs font-semibold text-navy hover:bg-navy/[0.06] transition-colors"
          >
            Edit
          </button>
          {isConverted ? (
            <button
              onClick={onOpenDeal}
              className="px-3 h-8 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1"
            >
              View deal
              <ArrowRightIcon className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={onConvert}
              className="px-3 h-8 rounded-lg text-xs font-semibold bg-gold text-navy hover:bg-gold-light transition-colors"
            >
              Convert
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="w-8 h-8 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-30"
            aria-label="Delete lead"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────── Sources leaderboard ───────────────────────────
function SourcesTab({ leads }) {
  const stats = useMemo(() => {
    const map = {}
    leads.forEach((l) => {
      // Group referrals by referrer name; everything else by source.
      const key = l.source === 'Referral' && l.referrer_name
        ? `Referral · ${l.referrer_name}`
        : l.source || 'Other'
      if (!map[key]) map[key] = { source: key, total: 0, converted: 0, hot: 0 }
      map[key].total++
      if (l.converted_to_deal_id) map[key].converted++
      if (l.temperature === 'Hot') map[key].hot++
    })
    return Object.values(map)
      .map((s) => ({ ...s, rate: s.total ? Math.round((s.converted / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  if (stats.length === 0) {
    return (
      <div className="card text-center py-12">
        <FunnelIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
        <p className="text-navy font-semibold">No source data yet</p>
        <p className="text-muted text-sm mt-1">Add leads to see source performance.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-navy/[0.06]">
        <h2 className="font-display text-lg font-bold text-navy">Source Performance</h2>
        <p className="text-muted text-xs mt-0.5">Where your leads are coming from</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
            <th className="px-5 py-3">Source</th>
            <th className="px-5 py-3 text-right">Leads</th>
            <th className="px-5 py-3 text-right">Hot</th>
            <th className="px-5 py-3 text-right">Converted</th>
            <th className="px-5 py-3 text-right">Conv. Rate</th>
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
              <td className="px-5 py-3 text-right text-red-600 font-semibold">{s.hot || '—'}</td>
              <td className="px-5 py-3 text-right text-green-600 font-semibold">{s.converted}</td>
              <td className="px-5 py-3 text-right">
                <span className={`font-bold ${
                  s.rate >= 30 ? 'text-green-600' : s.rate >= 15 ? 'text-gold-dark' : 'text-muted'
                }`}>
                  {s.rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────── Convert modal ───────────────────────────
function ConvertModal({ lead, onConfirm, onCancel }) {
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onCancel}
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
      />
      <div className="relative bg-white w-full md:w-auto md:min-w-[420px] max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-pop animate-fade-in pb-safe md:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center shrink-0">
            <ArrowRightIcon className="w-5 h-5" />
          </div>
          <button
            onClick={onCancel}
            className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <h3 className="font-display text-xl font-bold text-navy mt-3">
          Convert {fullName} to a deal?
        </h3>
        <p className="text-muted text-sm mt-2">
          We'll prefill the new deal form with the lead's contact info and interest type ({lead.interest_type}).
          You can edit anything before saving.
        </p>
        <div className="flex flex-col-reverse md:flex-row gap-2 mt-5">
          <button onClick={onCancel} className="btn-outline flex-1">Cancel</button>
          <button onClick={onConfirm} className="btn-primary flex-1">
            Convert to Deal
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Empty state ───────────────────────────
function EmptyLeads({ hasAny, search, onAdd }) {
  if (search) {
    return (
      <div className="text-center py-16">
        <p className="text-navy font-semibold">No matches found</p>
        <p className="text-muted text-sm mt-1">Try a different search term.</p>
      </div>
    )
  }
  if (hasAny) {
    return (
      <div className="text-center py-16">
        <p className="text-navy font-semibold">No leads in this filter</p>
        <p className="text-muted text-sm mt-1">Switch tabs or temperatures to see other leads.</p>
      </div>
    )
  }
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-3">
        <FunnelIcon className="w-7 h-7 text-navy/30" />
      </div>
      <p className="text-navy font-semibold">No leads yet</p>
      <p className="text-muted text-sm mt-1">Capture prospects before they become deals.</p>
      <button onClick={onAdd} className="btn-primary mt-5 inline-flex w-auto px-6">
        + New Lead
      </button>
    </div>
  )
}

function formatBudgetShort(min, max) {
  if (!min && !max) return '—'
  const fmt = (v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `≤ ${fmt(max)}`
}
