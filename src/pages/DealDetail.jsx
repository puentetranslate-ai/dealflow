import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PHASES, PHASE_STYLES, LOG_TYPES, DEFAULT_CHECKLIST } from '../lib/constants'
import { formatCurrency, formatDate, formatDateTime, daysUntil, isPastDue } from '../lib/utils'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import BottomNav from '../components/BottomNav'

const TABS = ['Overview', 'Checklist', 'Log']

const LOG_ICONS = {
  Call: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Text: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  Email: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'In-Person': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
}

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deal, setDeal] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)

  // Checklist state
  const [checklistItems, setChecklistItems] = useState([])
  const [checklistLoaded, setChecklistLoaded] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(null)

  // Log state
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

  useEffect(() => {
    fetchDeal()
  }, [id])

  useEffect(() => {
    if (tab === 'Checklist' && !checklistLoaded) fetchChecklist()
    if (tab === 'Log' && !logLoaded) fetchLog()
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
      .from('checklist_items')
      .select('*')
      .eq('deal_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!error) {
      if (data.length === 0) {
        await seedChecklist()
      } else {
        setChecklistItems(data)
        setChecklistLoaded(true)
      }
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
    await supabase
      .from('checklist_items')
      .update({ is_checked: newVal })
      .eq('id', item.id)
      .eq('user_id', user.id)
  }

  const saveDueDate = async (itemId, date) => {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, due_date: date || null } : i))
    )
    await supabase
      .from('checklist_items')
      .update({ due_date: date || null })
      .eq('id', itemId)
      .eq('user_id', user.id)
    setEditingDueDate(null)
  }

  const fetchLog = async () => {
    const { data } = await supabase
      .from('comm_logs')
      .select('*')
      .eq('deal_id', id)
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })

    setLogEntries(data || [])
    setLogLoaded(true)
  }

  const saveLogEntry = async () => {
    if (!logForm.summary.trim()) {
      setLogError('Summary is required.')
      return
    }
    setLogSaving(true)
    setLogError(null)

    const { data, error } = await supabase
      .from('comm_logs')
      .insert({
        deal_id: id,
        user_id: user.id,
        log_type: logForm.log_type,
        contact_name: logForm.contact_name || null,
        summary: logForm.summary.trim(),
        logged_at: new Date(logForm.logged_at).toISOString(),
      })
      .select()
      .single()

    if (error) {
      setLogError(error.message)
    } else {
      setLogEntries((prev) => [data, ...prev])
      setLogForm({
        log_type: 'Call',
        contact_name: '',
        summary: '',
        logged_at: new Date().toISOString().slice(0, 16),
      })
    }
    setLogSaving(false)
  }

  const groupedChecklist = PHASES.filter((p) => p !== 'Closed').reduce((acc, phase) => {
    acc[phase] = checklistItems.filter((i) => i.phase === phase)
    return acc
  }, {})

  const closingDays = deal?.closing_date ? daysUntil(deal.closing_date) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      {/* Header */}
      <div className="bg-navy px-4 pt-14 pb-4 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => navigate(-1)}
            className="text-muted p-1 -ml-1 min-h-[44px] flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {tab === 'Overview' && (
            <button
              onClick={() => navigate(`/deals/${id}/edit`)}
              className="text-gold text-sm font-semibold min-h-[44px]"
            >
              Edit
            </button>
          )}
        </div>
        <h2 className="font-display text-xl font-bold text-white leading-tight pr-8">{deal.address}</h2>
        <div className="mt-1">
          <PhaseBadge phase={deal.phase} size="sm" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-white/10 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t ? 'bg-white text-navy' : 'text-white/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'Overview' && (
        <div className="px-4 pt-5 space-y-4">
          {/* Key Numbers */}
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted font-medium">Sale Price</p>
              <p className="text-navy font-bold text-lg mt-0.5">{formatCurrency(deal.sale_price)}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Commission ({deal.commission_pct}%)</p>
              <p className="text-navy font-bold text-lg mt-0.5">
                {formatCurrency(((deal.sale_price || 0) * (deal.commission_pct || 0)) / 100)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Offer Date</p>
              <p className="text-navy font-semibold text-sm mt-0.5">{formatDate(deal.offer_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Closing Date</p>
              <p className={`font-semibold text-sm mt-0.5 ${closingDays !== null && closingDays < 0 ? 'text-red-500' : closingDays !== null && closingDays <= 7 ? 'text-orange-500' : 'text-navy'}`}>
                {formatDate(deal.closing_date)}
                {closingDays !== null && closingDays >= 0 && (
                  <span className="text-muted font-normal text-xs ml-1">({closingDays}d)</span>
                )}
              </p>
            </div>
          </div>

          {/* Buyer Card */}
          {(deal.buyer_name || deal.buyer_phone || deal.buyer_email) && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Buyer</p>
                  <p className="text-navy font-semibold text-sm leading-tight">{deal.buyer_name || '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {deal.buyer_phone && (
                  <a href={`tel:${deal.buyer_phone}`} className="flex items-center gap-2 text-sm text-navy min-h-[44px]">
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {deal.buyer_phone}
                  </a>
                )}
                {deal.buyer_email && (
                  <a href={`mailto:${deal.buyer_email}`} className="flex items-center gap-2 text-sm text-navy min-h-[44px] truncate">
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {deal.buyer_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Seller Card */}
          {(deal.seller_name || deal.seller_phone || deal.seller_email) && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Seller</p>
                  <p className="text-navy font-semibold text-sm leading-tight">{deal.seller_name || '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {deal.seller_phone && (
                  <a href={`tel:${deal.seller_phone}`} className="flex items-center gap-2 text-sm text-navy min-h-[44px]">
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {deal.seller_phone}
                  </a>
                )}
                {deal.seller_email && (
                  <a href={`mailto:${deal.seller_email}`} className="flex items-center gap-2 text-sm text-navy min-h-[44px] truncate">
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {deal.seller_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {deal.notes && (
            <div className="card p-4">
              <p className="section-title">Notes</p>
              <p className="text-navy text-sm leading-relaxed whitespace-pre-wrap">{deal.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Checklist Tab ── */}
      {tab === 'Checklist' && (
        <div className="px-4 pt-5 space-y-5">
          {!checklistLoaded ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : (
            PHASES.filter((p) => p !== 'Closed').map((phase) => {
              const items = groupedChecklist[phase] || []
              const phaseStyle = PHASE_STYLES[phase]
              const doneCount = items.filter((i) => i.is_checked).length

              return (
                <div key={phase}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${phaseStyle.dot}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${phaseStyle.text}`}>{phase}</span>
                    </div>
                    <span className="text-xs text-muted">{doneCount}/{items.length}</span>
                  </div>

                  <div className="card overflow-hidden divide-y divide-gray-50">
                    {items.map((item) => {
                      const pastDue = !item.is_checked && isPastDue(item.due_date)
                      const isEditingThis = editingDueDate === item.id

                      return (
                        <div key={item.id} className={`px-4 py-3 ${pastDue ? 'bg-red-50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleItem(item)}
                              className={`w-5 h-5 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                                item.is_checked
                                  ? 'bg-green-500 border-green-500'
                                  : pastDue
                                  ? 'border-red-400'
                                  : 'border-gray-300'
                              }`}
                            >
                              {item.is_checked && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${item.is_checked ? 'line-through text-gray-400' : pastDue ? 'text-red-600 font-medium' : 'text-navy'}`}>
                                {item.label}
                              </p>

                              {isEditingThis ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <input
                                    type="date"
                                    defaultValue={item.due_date || ''}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gold"
                                    onBlur={(e) => saveDueDate(item.id, e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => saveDueDate(item.id, '')} className="text-xs text-muted">
                                    Clear
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingDueDate(item.id)}
                                  className="flex items-center gap-1 mt-1"
                                >
                                  <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                                    <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                                    <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                                    <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                                  </svg>
                                  <span className={`text-xs ${item.due_date ? (pastDue ? 'text-red-500 font-semibold' : 'text-gold font-medium') : 'text-muted'}`}>
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
            })
          )}
        </div>
      )}

      {/* ── Communication Log Tab ── */}
      {tab === 'Log' && (
        <div className="px-4 pt-5 space-y-4">
          {/* Log Entry Form */}
          <div className="card p-4 space-y-3">
            <p className="section-title">New Entry</p>

            {logError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-xs">
                {logError}
              </div>
            )}

            {/* Type selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {LOG_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setLogForm((f) => ({ ...f, log_type: type }))}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    logForm.log_type === type
                      ? 'bg-navy text-white'
                      : 'bg-cream text-muted'
                  }`}
                >
                  <span className={logForm.log_type === type ? 'text-gold' : 'text-muted'}>
                    {LOG_ICONS[type]}
                  </span>
                  {type}
                </button>
              ))}
            </div>

            <div>
              <label className="label">Contact (who was this with?)</label>
              <input
                type="text"
                value={logForm.contact_name}
                onChange={(e) => setLogForm((f) => ({ ...f, contact_name: e.target.value }))}
                className="input-field"
                placeholder="e.g. John Buyer, Lender, Title Co."
              />
            </div>

            <div>
              <label className="label">Summary *</label>
              <textarea
                value={logForm.summary}
                onChange={(e) => setLogForm((f) => ({ ...f, summary: e.target.value }))}
                className="input-field resize-none"
                rows={3}
                placeholder="What was discussed or agreed upon…"
              />
            </div>

            <div>
              <label className="label">Date & Time</label>
              <input
                type="datetime-local"
                value={logForm.logged_at}
                onChange={(e) => setLogForm((f) => ({ ...f, logged_at: e.target.value }))}
                className="input-field"
              />
            </div>

            <button onClick={saveLogEntry} disabled={logSaving} className="btn-primary">
              {logSaving ? <LoadingSpinner size="sm" /> : 'Save Log Entry'}
            </button>
          </div>

          {/* Past Entries */}
          {!logLoaded ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : logEntries.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No log entries yet.</p>
          ) : (
            <div className="space-y-3">
              {logEntries.map((entry) => (
                <div key={entry.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center shrink-0 text-navy mt-0.5">
                      {LOG_ICONS[entry.log_type] || LOG_ICONS['Note']}
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
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
