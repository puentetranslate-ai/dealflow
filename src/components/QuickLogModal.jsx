import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQuickLog } from '../context/QuickLogContext'
import { LOG_TYPES } from '../lib/constants'
import LoadingSpinner from './LoadingSpinner'
import { XIcon, PhaseDotIcons, CheckIcon } from './Icon'

// Bottom sheet (mobile) / centered modal (desktop) for fast comm logging.
// Mounted once globally in AppLayout — opens via useQuickLog().setOpen(true).
//
// Loads the user's active deals on first open. Auto-suggests buyer/seller
// names from the chosen deal. Inserts to comm_logs and shows a toast.

export default function QuickLogModal() {
  const { open, setOpen } = useQuickLog()
  const { user } = useAuth()
  const [deals, setDeals] = useState([])
  const [dealsLoaded, setDealsLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const summaryRef = useRef(null)

  // Lazy-load deals the first time the modal opens
  useEffect(() => {
    if (!open || dealsLoaded) return
    supabase
      .from('deals')
      .select('id, address, buyer_name, seller_name, phase')
      .eq('user_id', user.id)
      .neq('phase', 'Closed')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || [])
        setDealsLoaded(true)
      })
  }, [open, user.id, dealsLoaded])

  // Reset form whenever opening fresh
  useEffect(() => {
    if (open) {
      setForm(initialForm())
      setSearch('')
      setError(null)
    }
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // Filter deals by search
  const filteredDeals = useMemo(() => {
    if (!search.trim()) return deals
    const q = search.toLowerCase()
    return deals.filter((d) =>
      d.address?.toLowerCase().includes(q) ||
      d.buyer_name?.toLowerCase().includes(q) ||
      d.seller_name?.toLowerCase().includes(q)
    )
  }, [deals, search])

  const selectedDeal = deals.find((d) => d.id === form.deal_id)
  const contactSuggestions = selectedDeal
    ? [selectedDeal.buyer_name, selectedDeal.seller_name].filter(Boolean)
    : []

  const handleSelectDeal = (deal) => {
    setForm((f) => ({ ...f, deal_id: deal.id }))
    // Auto-focus summary after deal pick
    setTimeout(() => summaryRef.current?.focus(), 100)
  }

  const handleSave = async () => {
    if (!form.deal_id) { setError('Pick a deal first.'); return }
    if (!form.summary.trim()) { setError('Summary is required.'); return }
    setSaving(true); setError(null)

    const { error: dbErr } = await supabase.from('comm_logs').insert({
      deal_id: form.deal_id,
      user_id: user.id,
      log_type: form.log_type,
      contact_name: form.contact_name || null,
      summary: form.summary.trim(),
      logged_at: new Date(form.logged_at).toISOString(),
    })

    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }

    const addr = selectedDeal?.address?.split(',')[0] || 'deal'
    setToast(`${form.log_type} logged to ${addr}`)
    setOpen(false)
    setTimeout(() => setToast(null), 2400)
  }

  if (!open && !toast) return null

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
          />
          <div className="relative bg-white w-full md:w-[480px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-6 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-3 border-b border-navy/[0.06]">
              <h2 className="font-display text-lg font-bold text-navy">Quick Log</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-xs">
                  {error}
                </div>
              )}

              {/* Type pills */}
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

              {/* Deal selector */}
              <div>
                <label className="label">Deal</label>
                {!dealsLoaded ? (
                  <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
                ) : selectedDeal ? (
                  <div className="bg-cream rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-navy font-semibold text-sm truncate">{selectedDeal.address}</p>
                      <p className="text-muted text-xs">{selectedDeal.phase}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, deal_id: null, contact_name: '' }))}
                      className="text-xs font-semibold text-gold-dark hover:text-gold transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by address, buyer, or seller…"
                      className="input-field"
                    />
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-navy/[0.06] divide-y divide-navy/[0.04]">
                      {filteredDeals.length === 0 ? (
                        <p className="text-muted text-xs px-3 py-3 text-center">
                          {deals.length === 0 ? 'No active deals.' : 'No matches.'}
                        </p>
                      ) : (
                        filteredDeals.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleSelectDeal(d)}
                            className="w-full text-left px-3 py-2.5 hover:bg-cream/60 transition-colors min-h-[48px]"
                          >
                            <p className="text-navy font-semibold text-sm truncate">{d.address}</p>
                            <p className="text-muted text-xs truncate">
                              {d.phase}
                              {d.buyer_name && ` · ${d.buyer_name}`}
                              {d.seller_name && !d.buyer_name && ` · ${d.seller_name}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Contact */}
              {selectedDeal && (
                <div>
                  <label className="label">Contact</label>
                  <input
                    type="text"
                    list="quick-log-contacts"
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                    className="input-field"
                    placeholder="Who was this with?"
                  />
                  {contactSuggestions.length > 0 && (
                    <datalist id="quick-log-contacts">
                      {contactSuggestions.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  )}
                </div>
              )}

              {/* Summary */}
              {selectedDeal && (
                <div>
                  <label className="label">Summary</label>
                  <textarea
                    ref={summaryRef}
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    className="input-field resize-none"
                    rows={3}
                    placeholder="What was discussed…"
                  />
                </div>
              )}

              {/* Date/time */}
              {selectedDeal && (
                <div>
                  <label className="label">When</label>
                  <input
                    type="datetime-local"
                    value={form.logged_at}
                    onChange={(e) => setForm((f) => ({ ...f, logged_at: e.target.value }))}
                    className="input-field"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedDeal && (
              <div className="px-5 md:px-6 py-4 border-t border-navy/[0.06]">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full"
                >
                  {saving ? <LoadingSpinner size="sm" /> : 'Save Log Entry'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] bg-navy text-white text-sm font-semibold px-5 py-3 rounded-full shadow-pop animate-fade-in flex items-center gap-2">
          <CheckIcon className="w-4 h-4 text-gold" strokeWidth={2.5} />
          {toast}
        </div>
      )}
    </>
  )
}

function initialForm() {
  return {
    log_type: 'Call',
    deal_id: null,
    contact_name: '',
    summary: '',
    logged_at: new Date().toISOString().slice(0, 16),
  }
}
