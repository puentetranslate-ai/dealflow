import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate, calcCommission } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  SearchIcon, PhoneIcon, MailIcon, MessageIcon, PlusIcon, ArrowRightIcon, UsersIcon,
} from '../components/Icon'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'buyer', label: 'Buyers' },
  { id: 'seller', label: 'Sellers' },
]

export default function ClientDirectory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expandedKey, setExpandedKey] = useState(null)

  useEffect(() => {
    supabase
      .from('deals').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || [])
        setLoading(false)
      })
  }, [user.id])

  const clients = useMemo(() => {
    const list = []
    deals.forEach((deal) => {
      if (deal.buyer_name) {
        list.push({
          key: `${deal.id}-buyer`,
          name: deal.buyer_name,
          phone: deal.buyer_phone,
          email: deal.buyer_email,
          role: 'Buyer',
          deal,
          createdAt: deal.created_at,
        })
      }
      if (deal.seller_name) {
        list.push({
          key: `${deal.id}-seller`,
          name: deal.seller_name,
          phone: deal.seller_phone,
          email: deal.seller_email,
          role: 'Seller',
          deal,
          createdAt: deal.created_at,
        })
      }
    })
    return list
  }, [deals])

  const buyersCount = clients.filter((c) => c.role === 'Buyer').length
  const sellersCount = clients.filter((c) => c.role === 'Seller').length

  const filtered = useMemo(() => {
    let list = clients
    if (filter === 'buyer') list = list.filter((c) => c.role === 'Buyer')
    if (filter === 'seller') list = list.filter((c) => c.role === 'Seller')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.deal.address?.toLowerCase().includes(q)
      )
    }
    return list
  }, [clients, filter, search])

  // A-Z grouping (mobile)
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const groups = {}
    sorted.forEach((c) => {
      const letter = (c.name || '#')[0].toUpperCase().match(/[A-Z]/) ? c.name[0].toUpperCase() : '#'
      if (!groups[letter]) groups[letter] = []
      groups[letter].push(c)
    })
    return groups
  }, [filtered])

  const filterCounts = {
    all: clients.length,
    buyer: buyersCount,
    seller: sellersCount,
  }

  return (
    <AppLayout>
      {/* ── Mobile header ── */}
      <MobileHeader
        eyebrow="DIRECTORY"
        title="Clients"
        rightSlot={
          <button
            onClick={() => navigate('/deals/new')}
            className="w-9 h-9 bg-gold text-navy rounded-full flex items-center justify-center"
            aria-label="Add client"
          >
            <PlusIcon className="w-5 h-5" strokeWidth={2.5} />
          </button>
        }
      >
        <div className="relative mt-4">
          <SearchIcon className="w-4 h-4 text-white/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, address, or email…"
            className="w-full bg-white/[0.08] text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white/[0.14] transition-colors"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.id}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
              variant="dark"
            >
              {f.label} <span className="opacity-60 ml-0.5">{filterCounts[f.id]}</span>
            </FilterPill>
          ))}
        </div>
      </MobileHeader>

      {/* ── Desktop top bar ── */}
      <TopBar search={search} onSearchChange={setSearch} searchPlaceholder="Search clients…" />

      {/* ── Desktop title row ── */}
      <div className="hidden md:flex items-center justify-between px-8 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Directory</p>
          <h1 className="font-display text-3xl font-bold text-navy mt-1">
            Clients <span className="text-muted font-medium">({clients.length})</span>
          </h1>
        </div>
        <button
          onClick={() => navigate('/deals/new')}
          className="bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-5 h-10 flex items-center gap-2 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* ── Desktop filter row ── */}
      <div className="hidden md:flex items-center justify-between px-8 pb-3">
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <FilterPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="opacity-60 ml-0.5">{filterCounts[f.id]}</span>
            </FilterPill>
          ))}
        </div>
        <p className="text-xs text-muted">
          Showing <span className="font-semibold text-navy">{filtered.length}</span> of {clients.length}
        </p>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyClients hasAny={clients.length > 0} search={search} />
        ) : (
          <>
            {/* ── Mobile A-Z list ── */}
            <div className="md:hidden space-y-6">
              {Object.keys(grouped).sort().map((letter) => (
                <section key={letter}>
                  <h2 className="font-display text-xl font-bold text-gold-dark mb-2 px-1">{letter}</h2>
                  <div className="space-y-3">
                    {grouped[letter].map((c) => (
                      <ClientCard key={c.key} client={c} onView={() => navigate(`/deals/${c.deal.id}`)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Property</th>
                    <th className="px-5 py-3">Phase</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/[0.05]">
                  {filtered.map((c) => {
                    const isOpen = expandedKey === c.key
                    return (
                      <ClientRow
                        key={c.key}
                        client={c}
                        isOpen={isOpen}
                        onToggle={() => setExpandedKey(isOpen ? null : c.key)}
                        onViewDeal={() => navigate(`/deals/${c.deal.id}`)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─────────────────────────── Mobile card ───────────────────────────
function ClientCard({ client, onView }) {
  const initials = client.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
  return (
    <div className="card p-4">
      <div
        onClick={onView}
        className="flex items-start gap-3 cursor-pointer"
      >
        <div className="w-11 h-11 rounded-full bg-navy text-gold font-bold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-navy leading-tight">
            {client.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`badge-pill ${
              client.role === 'Buyer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {client.role}
            </span>
            <PhaseBadge phase={client.deal.phase} />
          </div>
          <p className="text-muted text-xs mt-2 truncate">{client.deal.address}</p>
        </div>
      </div>

      {(client.phone || client.email) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-navy/[0.05]">
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center gap-2 px-3 h-10 rounded-xl bg-gold text-navy text-xs font-semibold hover:bg-gold-light transition-colors min-w-0"
            >
              <PhoneIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{client.phone}</span>
            </a>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center gap-2 px-3 h-10 rounded-xl bg-navy/[0.04] text-navy text-xs font-semibold hover:bg-navy/[0.08] transition-colors min-w-0"
            >
              <MailIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Email</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Desktop table row ───────────────────────────
function ClientRow({ client, isOpen, onToggle, onViewDeal }) {
  const initials = client.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
  const since = client.createdAt ? format(new Date(client.createdAt), 'MMM yyyy') : '—'
  const commission = calcCommission(client.deal.sale_price, client.deal.commission_pct)

  return (
    <>
      <tr
        className="hover:bg-cream/60 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-navy text-gold font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-navy text-sm truncate">{client.name}</p>
              <p className="text-muted text-xs">Since {since}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3">
          <span className={`badge-pill ${
            client.role === 'Buyer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {client.role}
          </span>
        </td>
        <td className="px-5 py-3 text-navy/80 max-w-[260px] truncate">{client.deal.address}</td>
        <td className="px-5 py-3"><PhaseBadge phase={client.deal.phase} /></td>
        <td className="px-5 py-3 text-navy/80">{client.phone || '—'}</td>
        <td className="px-5 py-3 text-navy/80 truncate max-w-[200px]">{client.email || '—'}</td>
        <td className="px-5 py-3 text-right">
          <ArrowRightIcon
            className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="bg-cream/60 px-5 py-5 border-t border-navy/[0.04]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
              {/* Profile */}
              <div className="card p-5 lg:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-navy text-gold font-bold text-lg flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-navy leading-tight">{client.name}</h3>
                    <p className="text-muted text-xs">Client since {since}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <ActionBtn href={client.phone ? `tel:${client.phone}` : null} icon={<PhoneIcon className="w-4 h-4" />} label="Call" gold disabled={!client.phone} />
                  <ActionBtn href={client.email ? `mailto:${client.email}` : null} icon={<MailIcon className="w-4 h-4" />} label="Email" disabled={!client.email} />
                  <ActionBtn href={client.phone ? `sms:${client.phone}` : null} icon={<MessageIcon className="w-4 h-4" />} label="Text" disabled={!client.phone} />
                  <ActionBtn icon={<PlusIcon className="w-4 h-4" />} label="Note" />
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">Notes</p>
                  <textarea
                    rows={3}
                    placeholder="Quick notes about this client…"
                    className="input-field resize-none text-sm"
                    defaultValue=""
                  />
                </div>
              </div>

              {/* Contact details */}
              <div className="card p-5 lg:col-span-1">
                <p className="section-title">Contact</p>
                <dl className="space-y-3 text-sm">
                  <DataRow label="Email" value={client.email} />
                  <DataRow label="Phone" value={client.phone} />
                  <DataRow label="Role" value={client.role} />
                </dl>
              </div>

              {/* Deal */}
              <div className="bg-navy text-white rounded-2xl p-5 lg:col-span-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full -translate-y-12 translate-x-10 pointer-events-none" />
                <p className="text-gold text-[10px] font-semibold uppercase tracking-wider relative">Active Deal</p>
                <h4 className="font-display text-lg font-bold mt-1 leading-tight relative">{client.deal.address}</h4>
                <div className="grid grid-cols-2 gap-3 mt-4 relative">
                  <div>
                    <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Sale Price</p>
                    <p className="font-display text-xl font-bold mt-0.5">{formatCurrency(client.deal.sale_price)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Commission</p>
                    <p className="font-display text-xl font-bold text-gold mt-0.5">{formatCurrency(commission)}</p>
                  </div>
                </div>
                {client.deal.closing_date && (
                  <p className="text-white/70 text-xs mt-3 relative">Closes {formatDate(client.deal.closing_date)}</p>
                )}
                <button
                  onClick={onViewDeal}
                  className="relative mt-4 inline-flex items-center gap-1 text-gold text-xs font-bold uppercase tracking-wider hover:text-gold-light transition-colors"
                >
                  View full deal
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DataRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted text-xs uppercase tracking-wider font-semibold">{label}</dt>
      <dd className="text-navy text-sm truncate">{value || '—'}</dd>
    </div>
  )
}

function ActionBtn({ href, icon, label, gold, disabled }) {
  const cls = `flex items-center justify-center gap-1 h-10 rounded-xl text-xs font-semibold transition-colors ${
    disabled
      ? 'bg-navy/[0.04] text-navy/30 cursor-not-allowed'
      : gold
      ? 'bg-gold text-navy hover:bg-gold-light'
      : 'bg-navy/[0.04] text-navy hover:bg-navy/[0.08]'
  }`
  if (disabled || !href) return <span className={cls}>{icon}</span>
  return <a href={href} className={cls}>{icon}</a>
}

function FilterPill({ active, onClick, children, variant = 'light' }) {
  const dark = variant === 'dark'
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 h-9 rounded-full text-sm font-semibold transition-colors ${
        active
          ? dark ? 'bg-gold text-navy' : 'bg-navy text-white'
          : dark
            ? 'bg-white/[0.08] text-white/70 hover:bg-white/[0.14]'
            : 'bg-white text-navy/70 border border-navy/10 hover:border-navy/30'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyClients({ hasAny, search }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-3">
        <UsersIcon className="w-7 h-7 text-navy/30" />
      </div>
      <p className="text-navy font-semibold">
        {search ? 'No matches found' : hasAny ? 'No clients in this filter' : 'No clients yet'}
      </p>
      <p className="text-muted text-sm mt-1">
        {search
          ? 'Try a different search term.'
          : hasAny
          ? 'Switch tabs to see other clients.'
          : 'Clients appear automatically when you add deals.'}
      </p>
    </div>
  )
}
