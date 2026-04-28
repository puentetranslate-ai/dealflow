import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import { XIcon, CheckIcon } from './Icon'

// Reusable schedule-showing modal. Used both from DealDetail (with deal
// pre-fill) and Calendar (no pre-fill, with deal selector). Inserts into
// `showings`; on success calls onSaved with the new row.

export default function ShowingForm({
  open,
  onClose,
  onSaved,
  deal = null,           // pre-fill from this deal when provided
  allowDealPicker = false, // show deal selector when no deal provided (Calendar use case)
}) {
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm(deal))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [deals, setDeals] = useState([])

  useEffect(() => {
    if (open) {
      setForm(initialForm(deal))
      setError(null)
    }
  }, [open, deal?.id])

  useEffect(() => {
    if (!open || !allowDealPicker) return
    supabase
      .from('deals')
      .select('id, address, buyer_name, seller_name, phase')
      .eq('user_id', user.id)
      .neq('phase', 'Closed')
      .order('created_at', { ascending: false })
      .then(({ data }) => setDeals(data || []))
  }, [open, allowDealPicker, user.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const handleSave = async () => {
    if (!form.property_address.trim()) { setError('Property address is required.'); return }
    if (!form.showing_date) { setError('Pick a date.'); return }
    setSaving(true); setError(null)

    const { data, error: dbErr } = await supabase
      .from('showings')
      .insert({
        user_id: user.id,
        deal_id: form.deal_id || null,
        property_address: form.property_address.trim(),
        showing_date: form.showing_date,
        showing_time: form.showing_time || null,
        client_name: form.client_name || null,
        notes: form.notes || null,
      })
      .select().single()

    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }
    onSaved?.(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-[480px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-3 border-b border-navy/[0.06]">
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Schedule Showing</h2>
            {deal && (
              <p className="text-muted text-xs mt-0.5 truncate">{deal.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 w-9 h-9 rounded-full text-muted hover:text-navy hover:bg-navy/[0.04] flex items-center justify-center transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-xs">
              {error}
            </div>
          )}

          {allowDealPicker && !deal && (
            <div>
              <label className="label">Link to deal (optional)</label>
              <select
                value={form.deal_id || ''}
                onChange={(e) => {
                  const d = deals.find((x) => x.id === e.target.value)
                  setForm((f) => ({
                    ...f,
                    deal_id: e.target.value || null,
                    property_address: d?.address || f.property_address,
                    client_name: d?.buyer_name || f.client_name,
                  }))
                }}
                className="input-field"
              >
                <option value="">— None —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>{d.address}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Property address</label>
            <input
              type="text"
              value={form.property_address}
              onChange={(e) => setForm((f) => ({ ...f, property_address: e.target.value }))}
              className="input-field"
              placeholder="123 Main St, Tampa, FL"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={form.showing_date}
                onChange={(e) => setForm((f) => ({ ...f, showing_date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Time (optional)</label>
              <input
                type="time"
                value={form.showing_time}
                onChange={(e) => setForm((f) => ({ ...f, showing_time: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label">Client name</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              className="input-field"
              placeholder="Who is the showing for?"
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none"
              rows={3}
              placeholder="Lockbox code, what to highlight, what to ask…"
            />
          </div>
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-navy/[0.06]">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <LoadingSpinner size="sm" /> : (
              <>
                <CheckIcon className="w-5 h-5 mr-2" strokeWidth={2.5} />
                Schedule Showing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function initialForm(deal) {
  return {
    deal_id: deal?.id || null,
    property_address: deal?.address || '',
    showing_date: '',
    showing_time: '',
    client_name: deal?.buyer_name || '',
    notes: '',
  }
}
