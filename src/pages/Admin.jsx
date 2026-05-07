import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, formatDistanceToNow, isAfter, subDays, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isAdmin, computeUserStatus, trialDaysRemaining } from '../lib/admin'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import {
  SearchIcon, DownloadIcon, XIcon, ArrowRightIcon, LockIcon, CheckIcon,
} from '../components/Icon'

// Admin user dashboard. Gated client-side (redirects non-admins) AND
// server-side (api/admin-users.js validates the JWT email before returning
// data). Don't trust client-only checks — they're for UX, not security.

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'trial',   label: 'Trial' },
  { id: 'paying',  label: 'Paying' },
  { id: 'expired', label: 'Expired' },
]

const COLUMNS = [
  { id: 'full_name',       label: 'Name' },
  { id: 'email',           label: 'Email' },
  { id: 'subscription_status', label: 'Plan' },
  { id: 'created_at',      label: 'Signup' },
  { id: 'trial_days',      label: 'Days Left' },
  { id: 'last_sign_in_at', label: 'Last Sign-In' },
  { id: 'status',          label: 'Status' },
]

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [activeUser, setActiveUser] = useState(null)

  // Client-side gate. Server gate is the real security boundary; this just
  // bounces non-admins quickly so we never even fetch the user list.
  useEffect(() => {
    if (user && !isAdmin(user)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      // Pull the caller's access token to send to our admin endpoint.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No active session')

      const res = await fetch('/api/admin-users', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (data?.error) {
        setError(data.error + (data.hint ? ` — ${data.hint}` : ''))
        setUsers([])
      } else {
        setUsers(data.users || [])
      }
    } catch (e) {
      setError(e.message || 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && isAdmin(user)) fetchUsers()
  }, [user?.id])

  // ── Derived: enriched users with status + days left ──
  const enriched = useMemo(() => users.map((u) => ({
    ...u,
    status: computeUserStatus(u),
    trial_days: trialDaysRemaining(u.trial_started_at),
  })), [users])

  // ── Stats ──
  const stats = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const oneDayAgo = subDays(today, 1)

    let total = 0, activeTrials = 0, paying = 0, today_signups = 0, week_signups = 0

    for (const u of enriched) {
      total++
      if (u.status === 'Paying') paying++
      else if (u.status === 'Trial Active' || u.status === 'Trial Expiring') activeTrials++
      try {
        const created = u.created_at ? new Date(u.created_at) : null
        if (created && isAfter(created, oneDayAgo)) today_signups++
        if (created && isAfter(created, weekStart)) week_signups++
      } catch {}
    }
    return { total, activeTrials, paying, today_signups, week_signups }
  }, [enriched])

  // ── Filter + search + sort ──
  const visible = useMemo(() => {
    let list = enriched

    if (filter === 'trial') {
      list = list.filter((u) => u.status === 'Trial Active' || u.status === 'Trial Expiring')
    } else if (filter === 'paying') {
      list = list.filter((u) => u.status === 'Paying')
    } else if (filter === 'expired') {
      list = list.filter((u) => u.status === 'Trial Expired' || u.status === 'Cancelled')
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }

    const { key, dir } = sort
    const mult = dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1 * mult
      if (bv == null) return -1 * mult
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
      return String(av).localeCompare(String(bv)) * mult
    })
  }, [enriched, filter, search, sort])

  const toggleSort = (key) => {
    setSort((s) => s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Plan', 'Signup', 'Trial Days Left', 'Last Sign-In', 'Status']
    const rows = visible.map((u) => [
      csvEscape(u.full_name || ''),
      csvEscape(u.email || ''),
      csvEscape(u.subscription_status || 'trial'),
      csvEscape(u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') : ''),
      csvEscape(u.trial_days),
      csvEscape(u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'yyyy-MM-dd HH:mm') : ''),
      csvEscape(u.status),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `dealflow-users-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // Used by the row modal to flip plan / extend trial via the admin endpoint.
  const updateRow = async (userId, patch) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/admin-users', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, ...patch }),
      })
      const data = await res.json()
      if (data?.error) throw new Error(data.error)
      // Refresh in-place
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...patch } : u))
      setActiveUser((u) => u && u.id === userId ? { ...u, ...patch } : u)
    } catch (e) {
      alert(`Update failed: ${e.message}`)
    }
  }

  if (!user || !isAdmin(user)) return null

  return (
    <AppLayout>
      <MobileHeader eyebrow="ADMIN" title="Admin" showBell />
      <TopBar />

      <div className="hidden md:block px-8 pt-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Admin</p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">User Management</h1>
        <p className="text-muted text-sm mt-0.5">Restricted to admin email — all reads/writes are server-validated.</p>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
            <p className="font-semibold">Couldn't load users</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <StatCard label="Total Users" value={stats.total} />
          <StatCard label="Active Trials" value={stats.activeTrials} tone="gold" />
          <StatCard label="Paying" value={stats.paying} tone="green" />
          <StatCard label="Signups Today" value={stats.today_signups} />
          <StatCard label="This Week" value={stats.week_signups} />
        </div>

        {/* Toolbar */}
        <div className="card p-4 md:p-5 mt-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full bg-white border border-navy/[0.08] rounded-xl pl-11 pr-4 py-2.5 text-sm text-navy placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm font-semibold text-navy bg-white border border-navy/10 rounded-xl px-3 h-10 focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>{f.label} {f.id === 'all' ? `(${enriched.length})` : ''}</option>
              ))}
            </select>
            <button
              onClick={exportCsv}
              disabled={visible.length === 0}
              className="bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-4 h-10 flex items-center gap-2 transition-colors disabled:opacity-40"
            >
              <DownloadIcon className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <p className="text-muted text-xs mt-2">
            Showing <span className="font-semibold text-navy">{visible.length}</span> of {enriched.length}
          </p>
        </div>

        {/* Table */}
        <div className="card overflow-hidden mt-4">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 px-4">
              <LockIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
              <p className="text-navy font-semibold">No users to show</p>
              <p className="text-muted text-sm mt-1">Try a different filter or search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                    {COLUMNS.map((col) => (
                      <th key={col.id} className="px-5 py-3 select-none">
                        <button
                          onClick={() => toggleSort(col.id)}
                          className="inline-flex items-center gap-1 hover:text-navy transition-colors"
                        >
                          {col.label}
                          {sort.key === col.id && (
                            <span className="text-gold-dark">{sort.dir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/[0.05]">
                  {visible.map((u) => (
                    <UserRow key={u.id} user={u} onClick={() => setActiveUser(u)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row detail modal */}
      {activeUser && (
        <UserDetailModal
          user={activeUser}
          onClose={() => setActiveUser(null)}
          onUpdate={(patch) => updateRow(activeUser.id, patch)}
        />
      )}
    </AppLayout>
  )
}

// ─────────────────────────── Row ───────────────────────────
function UserRow({ user, onClick }) {
  const created = user.created_at ? new Date(user.created_at) : null
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null

  return (
    <tr
      onClick={onClick}
      className="hover:bg-cream/60 cursor-pointer transition-colors"
    >
      <td className="px-5 py-3">
        <p className="font-semibold text-navy text-sm">{user.full_name || <span className="text-muted italic">(no name)</span>}</p>
      </td>
      <td className="px-5 py-3 text-navy/80 truncate max-w-[260px]">{user.email}</td>
      <td className="px-5 py-3">
        <span className={`badge-pill ${planPillClass(user.subscription_status)}`}>
          {planLabel(user.subscription_status)}
        </span>
      </td>
      <td className="px-5 py-3 text-navy/80 whitespace-nowrap">
        {created ? format(created, 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-5 py-3 text-navy/80 whitespace-nowrap">
        {user.subscription_status === 'active' ? (
          <span className="text-muted">—</span>
        ) : (
          <span className={user.trial_days <= 5 ? 'text-red-500 font-semibold' : ''}>
            {user.trial_days}d
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-navy/80 whitespace-nowrap">
        {lastSignIn ? formatDistanceToNow(lastSignIn, { addSuffix: true }) : <span className="text-muted">never</span>}
      </td>
      <td className="px-5 py-3">
        <span className={`badge-pill ${statusPillClass(user.status)}`}>{user.status}</span>
      </td>
    </tr>
  )
}

// ─────────────────────────── Detail modal ───────────────────────────
function UserDetailModal({ user, onClose, onUpdate }) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const update = async (patch) => {
    setBusy(true)
    await onUpdate(patch)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-[560px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-3 border-b border-navy/[0.06]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">User</p>
            <h2 className="font-display text-xl font-bold text-navy mt-0.5">{user.full_name || '(no name)'}</h2>
            <p className="text-muted text-xs mt-0.5 truncate">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 space-y-4">
          <DetailRow label="Status" value={<span className={`badge-pill ${statusPillClass(user.status)}`}>{user.status}</span>} />
          <DetailRow label="Plan" value={planLabel(user.subscription_status)} />
          <DetailRow label="Trial started" value={user.trial_started_at ? format(new Date(user.trial_started_at), 'MMM d, yyyy h:mm a') : '—'} />
          <DetailRow label="Days remaining" value={`${user.trial_days}d`} />
          <DetailRow label="Email confirmed" value={user.email_confirmed_at ? '✓ Yes' : '✗ No'} />
          <DetailRow label="Account created" value={user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy h:mm a') : '—'} />
          <DetailRow label="Last sign-in" value={user.last_sign_in_at ? `${format(new Date(user.last_sign_in_at), 'MMM d, yyyy h:mm a')} (${formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })})` : 'Never'} />
          <DetailRow label="User ID" value={<code className="text-xs font-mono text-navy/70">{user.id}</code>} />
          <DetailRow label="Default commission" value={user.default_commission_pct != null ? `${user.default_commission_pct}%` : '—'} />

          {/* Manual subscription controls */}
          <div className="pt-2 border-t border-navy/[0.06]">
            <p className="section-title">Manage subscription</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <ActionButton
                label="Mark as Paying"
                disabled={busy || user.subscription_status === 'active'}
                onClick={() => update({ subscription_status: 'active' })}
              />
              <ActionButton
                label="Reset to Trial"
                disabled={busy || user.subscription_status === 'trial'}
                onClick={() => update({ subscription_status: 'trial', trial_started_at: new Date().toISOString() })}
              />
              <ActionButton
                label="Mark Cancelled"
                disabled={busy || user.subscription_status === 'cancelled'}
                onClick={() => update({ subscription_status: 'cancelled' })}
              />
              <ActionButton
                label="+30 day extension"
                disabled={busy}
                onClick={() => update({ trial_started_at: new Date().toISOString() })}
              />
            </div>
            <p className="text-muted text-[11px] mt-3 leading-snug">
              "Mark as Paying" should be used after Stripe checkout completes. "+30 day extension" resets the trial start to now, giving the user a fresh 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0 w-32">{label}</span>
      <span className="text-navy text-sm text-right break-all">{value}</span>
    </div>
  )
}

function ActionButton({ label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 bg-gold/15 hover:bg-gold/25 disabled:bg-navy/[0.04] disabled:text-muted disabled:cursor-not-allowed text-gold-dark text-xs font-semibold rounded-lg px-3 h-9 transition-colors"
    >
      <CheckIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

// ─────────────────────────── Helpers ───────────────────────────
function csvEscape(value) {
  if (value == null) return ''
  const s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function planLabel(status) {
  switch (status) {
    case 'active':    return 'Paying'
    case 'cancelled': return 'Cancelled'
    case 'expired':   return 'Expired'
    default:          return 'Trial'
  }
}

function planPillClass(status) {
  switch (status) {
    case 'active':    return 'bg-green-100 text-green-700'
    case 'cancelled': return 'bg-red-100 text-red-700'
    case 'expired':   return 'bg-red-100 text-red-700'
    default:          return 'bg-gold/15 text-gold-dark'
  }
}

function statusPillClass(status) {
  switch (status) {
    case 'Paying':         return 'bg-green-100 text-green-700'
    case 'Trial Active':   return 'bg-blue-100 text-blue-700'
    case 'Trial Expiring': return 'bg-amber-100 text-amber-700'
    case 'Trial Expired':  return 'bg-red-100 text-red-700'
    case 'Cancelled':      return 'bg-red-100 text-red-700'
    default:               return 'bg-navy/[0.04] text-navy/70'
  }
}
