import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PHASES, PHASE_STYLES, LOG_TYPES, DEFAULT_CHECKLIST } from '../lib/constants'
import {
  formatCurrency, formatDate, formatDateTime, daysUntil, daysInPhase, isPastDue, calcCommission,
} from '../lib/utils'
import AppLayout from '../components/AppLayout'
import MobileHeader from '../components/MobileHeader'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import PortalTab from '../components/PortalTab'
import {
  ArrowLeftIcon, ShareIcon, PhoneIcon, MailIcon, MessageIcon, UsersIcon, CheckIcon,
  CalendarIcon, PhaseDotIcons, ArrowRightIcon,
} from '../components/Icon'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'log', label: 'Communication' },
  { id: 'portal', label: 'Portal' },
]

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deal, setDeal] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Checklist
  const [checklistItems, setChecklistItems] = useState([])
  const [checklistLoaded, setChecklistLoaded] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(null)

  // Log
  const [logEntries, setLogEntries] = useState([])
  const [logLoaded, setLogLoaded] = useState(false)
  const [logForm, setLogForm] = useState({
    log_type: 'Call',
    contact_name: '',
    summary: '',
    logged_at: new Date().toISOString().slice(0, 16),
  })
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState(null)

  // Portal unread badge — counts client task completions newer than last
  // time the agent opened the Portal tab. Stored per-deal in localStorage.
  const [portalUnreadCount, setPortalUnreadCount] = useState(0)

  useEffect(() => { fetchDeal() }, [id])

  useEffect(() => {
    if (!id) return
    const lastViewed = localStorage.getItem(`portal-viewed:${id}`)
    const sinceIso = lastViewed || '1970-01-01T00:00:00Z'
    let cancelled = false
    supabase
      .from('client_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', id)
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .gt('completed_at', sinceIso)
      .then(({ count }) => {
        if (!cancelled && typeof count === 'number') setPortalUnreadCount(count)
      })
    return () => { cancelled = true }
  }, [id, user.id])
  useEffect(() => {
    if (tab === 'checklist' && !checklistLoaded) fetchChecklist()
    if (tab === 'log' && !logLoaded) fetchLog()
  }, [tab])

  const fetchDeal = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (error || !data) {
      navigate('/dashboard', { replace: true })
      return
    }
    setDeal(data)
    setLoading(false)
  }

  const fetchChecklist = async () => {
    const { data, error } = await supabase
      .from('checklist_items').select('*')
      .eq('deal_id', id).eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) {
      if (data.length === 0) await seedChecklist()
      else { setChecklistItems(data); setChecklistLoaded(true) }
    }
  }

  const seedChecklist = async () => {
    const items = []
    for (const [phase, labels] of Object.entries(DEFAULT_CHECKLIST)) {
      for (const label of labels) {
        items.push({ deal_id: id, user_id: user.id, label, phase, is_checked: false })
      }
    }
    const { data } = await supabase.from('checklist_items').insert(items).select()
    setChecklistItems(data || [])
    setChecklistLoaded(true)
  }

  const toggleItem = async (item) => {
    const newVal = !item.is_checked
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: newVal } : i))
    )
    await supabase.from('checklist_items')
      .update({ is_checked: newVal })
      .eq('id', item.id).eq('user_id', user.id)
  }

  const saveDueDate = async (itemId, date) => {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, due_date: date || null } : i))
    )
    await supabase.from('checklist_items')
      .update({ due_date: date || null })
      .eq('id', itemId).eq('user_id', user.id)
    setEditingDueDate(null)
  }

  const fetchLog = async () => {
    const { data } = await supabase
      .from('comm_logs').select('*')
      .eq('deal_id', id).eq('user_id', user.id)
      .order('logged_at', { ascending: false })
    setLogEntries(data || [])
    setLogLoaded(true)
  }

  const saveLogEntry = async () => {
    if (!logForm.summary.trim()) { setLogError('Summary is required.'); return }
    setLogSaving(true); setLogError(null)
    const { data, error } = await supabase.from('comm_logs').insert({
      deal_id: id, user_id: user.id,
      log_type: logForm.log_type,
      contact_name: logForm.contact_name || null,
      summary: logForm.summary.trim(),
      logged_at: new Date(logForm.logged_at).toISOString(),
    }).select().single()
    if (error) setLogError(error.message)
    else {
      setLogEntries((prev) => [data, ...prev])
      setLogForm({
        log_type: 'Call', contact_name: '', summary: '',
        logged_at: new Date().toISOString().slice(0, 16),
      })
    }
    setLogSaving(false)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: deal?.address || 'Deal', url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert('Link copied to clipboard.') } catch {}
    }
  }

  // Derived
  const closingDays = deal?.closing_date ? daysUntil(deal.closing_date) : null
  const commission = deal ? calcCommission(deal.sale_price, deal.commission_pct) : 0
  const phaseDays = deal ? daysInPhase(deal.phase_changed_at || deal.created_at) : 0

  // Next deadline (for the right rail)
  const nextDeadline = useMemo(() => {
    return [...checklistItems]
      .filter((i) => !i.is_checked && i.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]
  }, [checklistItems])

  const groupedChecklist = PHASES.filter((p) => p !== 'Closed').reduce((acc, phase) => {
    acc[phase] = checklistItems.filter((i) => i.phase === phase)
    return acc
  }, {})

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
      {/* ── Mobile header ── */}
      <MobileHeader
        showBack
        rightSlot={
          <>
            <button
              onClick={handleShare}
              className="p-2 text-white/70 hover:text-white"
              aria-label="Share"
            >
              <ShareIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(`/deals/${id}/edit`)}
              className="text-gold text-sm font-semibold pl-2 pr-1"
            >
              Edit
            </button>
          </>
        }
      >
        <h1 className="font-display text-xl font-bold text-white leading-tight">
          {deal.address}
        </h1>
        <div className="mt-2">
          <PhaseBadge phase={deal.phase} daysIn={phaseDays} />
        </div>

        {/* Mobile tabs */}
        <div className="flex gap-1 mt-4 bg-white/[0.08] rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                tab === t.id ? 'bg-white text-navy' : 'text-white/60'
              }`}
            >
              {t.label}
              {t.id === 'portal' && portalUnreadCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </div>
      </MobileHeader>

      {/* ── Desktop header ── */}
      <div className="hidden md:flex items-center justify-between px-8 pt-7 pb-4">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Dashboard
            <span className="mx-1.5 text-navy/30">/</span>
            <span className="text-navy">Deal Detail</span>
          </button>
          <h1 className="font-display text-3xl font-bold text-navy leading-tight mt-3">
            {deal.address}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <PhaseBadge phase={deal.phase} daysIn={phaseDays} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleShare}
            className="bg-white border border-navy/10 hover:border-gold/40 text-navy text-sm font-medium rounded-xl px-4 h-10 flex items-center gap-2 transition-colors"
          >
            <ShareIcon className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={() => navigate(`/deals/${id}/edit`)}
            className="bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-5 h-10 flex items-center gap-2 transition-colors"
          >
            Edit Deal
          </button>
        </div>
      </div>

      {/* ── Desktop tabs ── */}
      <div className="hidden md:flex items-center gap-1 bg-white border-b border-navy/[0.06] px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              tab === t.id ? 'text-navy' : 'text-muted hover:text-navy'
            }`}
          >
            {t.label}
            {t.id === 'portal' && portalUnreadCount > 0 && (
              <span className="bg-gold text-navy text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {portalUnreadCount}
              </span>
            )}
            {tab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Content area: 2-col on desktop ── */}
      <div className="md:grid md:grid-cols-[1fr_320px] md:gap-6 px-5 md:px-8 pt-5 pb-32 md:pb-12">
        <div className="min-w-0 space-y-4 md:space-y-5">
          {tab === 'overview' && (
            <OverviewTab
              deal={deal}
              commission={commission}
              closingDays={closingDays}
              nextDeadline={nextDeadline}
            />
          )}

          {tab === 'checklist' && (
            checklistLoaded ? (
              <ChecklistTab
                grouped={groupedChecklist}
                editingId={editingDueDate}
                onEdit={setEditingDueDate}
                onToggle={toggleItem}
                onSaveDate={saveDueDate}
              />
            ) : (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            )
          )}

          {tab === 'log' && (
            <LogTab
              entries={logEntries}
              loaded={logLoaded}
              form={logForm}
              setForm={setLogForm}
              saving={logSaving}
              error={logError}
              onSave={saveLogEntry}
              defaultContacts={[deal.buyer_name, deal.seller_name].filter(Boolean)}
            />
          )}

          {tab === 'portal' && (
            <PortalTab deal={deal} onUnreadChange={setPortalUnreadCount} />
          )}
        </div>

        {/* ── Right rail (desktop only) ── */}
        <aside className="hidden md:block space-y-4">
          {/* Next Deadline card */}
          <div className="bg-gradient-to-br from-gold to-gold-light rounded-2xl p-5 text-navy shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Next Deadline</p>
            {nextDeadline ? (
              <>
                <p className="font-display text-4xl font-bold leading-none mt-2">
                  {Math.max(0, daysUntil(nextDeadline.due_date) ?? 0)}d
                </p>
                <p className="font-semibold text-sm mt-2 leading-snug">{nextDeadline.label}</p>
                <p className="text-navy/70 text-xs mt-1">{formatDate(nextDeadline.due_date)}</p>
                <button
                  onClick={() => toggleItem(nextDeadline)}
                  className="mt-4 w-full bg-navy text-white text-sm font-semibold rounded-lg py-2 hover:bg-navy-light transition-colors"
                >
                  Mark Complete
                </button>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-bold mt-2">All caught up</p>
                <p className="text-navy/70 text-xs mt-1">No upcoming deadlines on this deal.</p>
              </>
            )}
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <p className="section-title">Deal Timeline</p>
            <PhaseTimeline currentPhase={deal.phase} closingDate={deal.closing_date} />
          </div>
        </aside>
      </div>
    </AppLayout>
  )
}

// ─────────────────────────── Overview tab ───────────────────────────
function OverviewTab({ deal, commission, closingDays, nextDeadline }) {
  return (
    <>
      {/* Sale price + commission card */}
      <div className="card p-5 grid grid-cols-2 gap-4 border-l-4 border-l-gold">
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Sale Price</p>
          <p className="font-display text-2xl font-bold text-navy mt-1 leading-none">
            {formatCurrency(deal.sale_price)}
          </p>
          <p className="text-xs text-muted mt-1.5">Offered {formatDate(deal.offer_date)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
            Commission ({deal.commission_pct || 0}%)
          </p>
          <p className="font-display text-2xl font-bold text-gold-dark mt-1 leading-none">
            {formatCurrency(commission)}
          </p>
          <p className="text-xs text-muted mt-1.5">{deal.agent_role === 'buyer' ? "Buyer's Side" : 'Listing Side'}</p>
        </div>
      </div>

      {/* Closing card (mobile-emphasized — desktop has the same info in the right rail) */}
      {deal.closing_date && (
        <div className="md:hidden bg-navy text-white rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
          <p className="text-gold text-xs font-bold uppercase tracking-wider relative">Estimated Close</p>
          <div className="flex items-baseline gap-2 mt-2 relative">
            <p className="font-display text-5xl font-bold text-gold leading-none">
              {closingDays !== null ? Math.max(0, closingDays) : '—'}
            </p>
            <p className="text-white/70 text-sm">days remaining</p>
          </div>
          <p className="text-white/80 text-sm mt-2 relative">{formatDate(deal.closing_date)}</p>
        </div>
      )}

      {/* Next step (mobile only — desktop sees the gold rail card) */}
      {nextDeadline && (
        <div className="md:hidden card p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-gold/15 text-gold-dark rounded-xl flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Next Step</p>
            <p className="text-navy font-semibold text-sm mt-0.5">{nextDeadline.label}</p>
          </div>
          <span className={`text-xs font-bold whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full ${
            isPastDue(nextDeadline.due_date)
              ? 'bg-red-100 text-red-600'
              : 'bg-gold/15 text-gold-dark'
          }`}>
            {formatDate(nextDeadline.due_date)}
          </span>
        </div>
      )}

      {/* Buyer */}
      <ContactCard
        role="Buyer"
        name={deal.buyer_name}
        phone={deal.buyer_phone}
        email={deal.buyer_email}
      />

      {/* Seller */}
      <ContactCard
        role="Seller"
        name={deal.seller_name}
        phone={deal.seller_phone}
        email={deal.seller_email}
      />

      {/* Notes */}
      {deal.notes && (
        <div className="card p-5">
          <p className="section-title">Notes</p>
          <p className="text-navy text-sm leading-relaxed whitespace-pre-wrap">{deal.notes}</p>
        </div>
      )}
    </>
  )
}

function ContactCard({ role, name, phone, email }) {
  if (!name && !phone && !email) return null
  const initials = (name || role).split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-navy text-gold font-bold text-base flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{role}</p>
          <p className="font-display text-base font-bold text-navy leading-tight">
            {name || '—'}
          </p>
        </div>
        <span className={`badge-pill ${
          role === 'Buyer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
        }`}>
          {role}
        </span>
      </div>

      {(phone || email) && (
        <div className="space-y-1.5 text-sm">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-3 text-navy hover:text-gold-dark transition-colors min-h-[40px]">
              <PhoneIcon className="w-4 h-4 text-muted shrink-0" />
              <span className="truncate">{phone}</span>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-3 text-navy hover:text-gold-dark transition-colors min-h-[40px]">
              <MailIcon className="w-4 h-4 text-muted shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          )}
        </div>
      )}

      {(phone || email) && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <ActionBtn href={phone ? `tel:${phone}` : null} icon={<PhoneIcon className="w-5 h-5" />} label="Call" disabled={!phone} />
          <ActionBtn href={phone ? `sms:${phone}` : null} icon={<MessageIcon className="w-5 h-5" />} label="Text" disabled={!phone} />
          <ActionBtn href={email ? `mailto:${email}` : null} icon={<MailIcon className="w-5 h-5" />} label="Email" disabled={!email} />
        </div>
      )}
    </div>
  )
}

function ActionBtn({ href, icon, label, disabled }) {
  // Stacked icon-over-label layout so all three buttons fit comfortably on
  // narrow mobile widths with equal widths and a 48px min tap target.
  const cls = `w-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors py-2 ${
    disabled
      ? 'bg-navy/[0.04] text-muted cursor-not-allowed'
      : 'bg-navy/[0.04] text-navy hover:bg-gold hover:text-navy active:bg-gold-light'
  }`
  const content = <>{icon}<span className="leading-none">{label}</span></>
  if (disabled) return <span className={cls} aria-disabled="true">{content}</span>
  return <a href={href} className={cls}>{content}</a>
}

// ─────────────────────────── Checklist tab ───────────────────────────
function ChecklistTab({ grouped, editingId, onEdit, onToggle, onSaveDate }) {
  return (
    <div className="space-y-5">
      {PHASES.filter((p) => p !== 'Closed').map((phase) => {
        const items = grouped[phase] || []
        if (items.length === 0) return null
        const phaseStyle = PHASE_STYLES[phase]
        const doneCount = items.filter((i) => i.is_checked).length

        return (
          <div key={phase}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${phaseStyle.dot}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${phaseStyle.text}`}>
                  {phase}
                </span>
              </div>
              <span className="text-xs text-muted">{doneCount}/{items.length}</span>
            </div>

            <div className="card overflow-hidden divide-y divide-navy/[0.04]">
              {items.map((item) => {
                const pastDue = !item.is_checked && isPastDue(item.due_date)
                const isEditingThis = editingId === item.id

                return (
                  <div key={item.id} className={`px-4 py-3 ${pastDue ? 'bg-red-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggle(item)}
                        className={`w-5 h-5 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                          item.is_checked
                            ? 'bg-green-500 border-green-500'
                            : pastDue
                            ? 'border-red-400 bg-white'
                            : 'border-navy/20 bg-white hover:border-gold'
                        }`}
                        aria-pressed={item.is_checked}
                      >
                        {item.is_checked && (
                          <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${
                          item.is_checked
                            ? 'line-through text-muted'
                            : pastDue ? 'text-red-600 font-medium' : 'text-navy'
                        }`}>
                          {item.label}
                        </p>

                        {isEditingThis ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="date"
                              defaultValue={item.due_date || ''}
                              className="text-xs border border-navy/15 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gold"
                              onBlur={(e) => onSaveDate(item.id, e.target.value)}
                              autoFocus
                            />
                            <button
                              onClick={() => onSaveDate(item.id, '')}
                              className="text-xs text-muted hover:text-navy"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onEdit(item.id)}
                            className="flex items-center gap-1.5 mt-1 group"
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-muted group-hover:text-gold-dark transition-colors" />
                            <span className={`text-xs ${
                              item.due_date
                                ? pastDue
                                  ? 'text-red-500 font-semibold'
                                  : 'text-gold-dark font-medium'
                                : 'text-muted'
                            }`}>
                              {item.due_date ? formatDate(item.due_date) : 'Set due date'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Log tab ───────────────────────────
function LogTab({ entries, loaded, form, setForm, saving, error, onSave, defaultContacts }) {
  return (
    <div className="space-y-4">
      {/* Entry form */}
      <div className="card p-5 space-y-4">
        <p className="section-title">New Entry</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-xs">
            {error}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {LOG_TYPES.map((type) => {
            const Icon = PhaseDotIcons[type]
            const active = form.log_type === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({ ...f, log_type: type }))}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-navy text-white' : 'bg-navy/[0.04] text-navy/70 hover:bg-navy/[0.08]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-gold' : 'text-muted'}`} />
                {type}
              </button>
            )
          })}
        </div>

        <div>
          <label className="label">Contact</label>
          <input
            type="text"
            list="contact-suggestions"
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            className="input-field"
            placeholder="Who was this with?"
          />
          {defaultContacts.length > 0 && (
            <datalist id="contact-suggestions">
              {defaultContacts.map((c) => <option key={c} value={c} />)}
            </datalist>
          )}
        </div>

        <div>
          <label className="label">Summary</label>
          <textarea
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            className="input-field resize-none"
            rows={3}
            placeholder="What was discussed or agreed upon…"
          />
        </div>

        <div>
          <label className="label">Date &amp; Time</label>
          <input
            type="datetime-local"
            value={form.logged_at}
            onChange={(e) => setForm((f) => ({ ...f, logged_at: e.target.value }))}
            className="input-field"
          />
        </div>

        <button onClick={onSave} disabled={saving} className="btn-primary w-full">
          {saving ? <LoadingSpinner size="sm" /> : 'Save Log Entry'}
        </button>
      </div>

      {/* Past entries */}
      {!loaded ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : entries.length === 0 ? (
        <div className="card text-center py-10 px-4">
          <p className="text-navy font-semibold">No entries yet</p>
          <p className="text-muted text-sm mt-1">Log calls, texts, and emails as they happen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const Icon = PhaseDotIcons[entry.log_type] || PhaseDotIcons.Note
            return (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-navy/[0.06] rounded-xl flex items-center justify-center shrink-0 text-navy">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-navy">{entry.log_type}</span>
                        {entry.contact_name && (
                          <span className="text-xs text-muted">· {entry.contact_name}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted shrink-0">{formatDateTime(entry.logged_at)}</span>
                    </div>
                    <p className="text-navy text-sm leading-relaxed">{entry.summary}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Vertical phase timeline ───────────────────────────
function PhaseTimeline({ currentPhase, closingDate }) {
  const list = PHASES.filter((p) => p !== 'Closed')
  const currentIdx = list.indexOf(currentPhase)

  return (
    <ol className="relative space-y-5 mt-4">
      {list.map((phase, idx) => {
        const isCurrent = idx === currentIdx
        const isPast = idx < currentIdx
        const style = PHASE_STYLES[phase]
        return (
          <li key={phase} className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`w-3 h-3 rounded-full border-2 ${
                  isPast
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                    ? `${style.dot} ${style.dot} ring-4 ring-gold/20`
                    : 'bg-white border-navy/15'
                }`}
              />
              {idx < list.length - 1 && (
                <span className={`w-0.5 h-7 ${isPast ? 'bg-green-300' : 'bg-navy/10'}`} />
              )}
            </div>
            <div>
              <p className={`text-sm font-semibold leading-tight ${
                isCurrent ? 'text-navy' : isPast ? 'text-navy/60' : 'text-navy/40'
              }`}>
                {phase}
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-gold-dark">
                    Current
                  </span>
                )}
              </p>
              {idx === list.length - 1 && closingDate && (
                <p className="text-xs text-muted mt-0.5">Closes {formatDate(closingDate)}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
