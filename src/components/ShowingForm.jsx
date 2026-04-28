import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import { XIcon, CheckIcon, MailIcon, ArrowRightIcon } from './Icon'

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

  // Agent network notification state
  const [agents, setAgents] = useState([])
  const [agentsLoaded, setAgentsLoaded] = useState(false)
  const [selectedAgentIds, setSelectedAgentIds] = useState(() => new Set())
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendStatus, setSendStatus] = useState(null) // 'sending' | { sent, failed, total }

  useEffect(() => {
    if (open) {
      setForm(initialForm(deal))
      setError(null)
      setSendStatus(null)
      setSelectedAgentIds(new Set())
      setPreviewOpen(false)
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

  // Load the user's agent network the first time the modal opens
  useEffect(() => {
    if (!open || agentsLoaded) return
    supabase
      .from('agent_contacts')
      .select('id, full_name, email, brokerage')
      .eq('user_id', user.id)
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setAgents(data || [])
        setAgentsLoaded(true)
      })
  }, [open, user.id, agentsLoaded])

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

    if (dbErr) {
      setSaving(false)
      setError(dbErr.message)
      return
    }

    onSaved?.(data)

    // If agents were selected, fire the email blast. Showing save is committed
    // either way — email failure never blocks the save.
    const selected = agents.filter((a) => selectedAgentIds.has(a.id))
    if (selected.length > 0) {
      setSendStatus('sending')
      try {
        const { data: profile } = await supabase
          .from('profiles').select('full_name').eq('id', user.id).single()
        const agentName = profile?.full_name || user.user_metadata?.full_name || ''

        const resp = await fetch('/api/send-showing-blast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentContacts: selected.map((a) => ({ email: a.email, full_name: a.full_name })),
            propertyAddress: form.property_address.trim(),
            showingDate: form.showing_date,
            showingTime: form.showing_time || null,
            clientName: form.client_name || null,
            agentName,
            agentPhone: null,
            agentEmail: user.email,
            notes: form.notes || null,
          }),
        })
        const result = await resp.json().catch(() => ({}))
        setSendStatus({
          sent: result.sent || 0,
          failed: result.failed || 0,
          total: result.total || selected.length,
          error: result.error || null,
        })
        // Show the result for ~2s, then close
        setTimeout(() => { setSaving(false); onClose() }, 2000)
        return
      } catch {
        setSendStatus({ sent: 0, failed: selected.length, total: selected.length, error: 'network' })
        setTimeout(() => { setSaving(false); onClose() }, 2000)
        return
      }
    }

    setSaving(false)
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

          {/* ── Notify Agent Network ── */}
          <NotifyAgentSection
            agents={agents}
            agentsLoaded={agentsLoaded}
            selectedIds={selectedAgentIds}
            setSelectedIds={setSelectedAgentIds}
            previewOpen={previewOpen}
            setPreviewOpen={setPreviewOpen}
            form={form}
          />
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-navy/[0.06]">
          {sendStatus === 'sending' ? (
            <div className="flex items-center justify-center gap-2 py-3 text-navy text-sm font-semibold">
              <LoadingSpinner size="sm" />
              Sending to {selectedAgentIds.size} {selectedAgentIds.size === 1 ? 'agent' : 'agents'}…
            </div>
          ) : sendStatus && typeof sendStatus === 'object' ? (
            <div className={`text-center text-sm font-semibold py-3 rounded-xl ${
              sendStatus.failed === 0
                ? 'bg-green-50 text-green-700'
                : sendStatus.sent === 0
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {sendStatus.error
                ? `Couldn't send notifications (${sendStatus.error})`
                : sendStatus.failed === 0
                ? `Notified ${sendStatus.sent} ${sendStatus.sent === 1 ? 'agent' : 'agents'}`
                : sendStatus.sent === 0
                ? `Sent to 0 of ${sendStatus.total} — all failed`
                : `Sent to ${sendStatus.sent} of ${sendStatus.total} — some failed`}
            </div>
          ) : (
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? <LoadingSpinner size="sm" /> : (
                <>
                  <CheckIcon className="w-5 h-5 mr-2" strokeWidth={2.5} />
                  {selectedAgentIds.size > 0
                    ? `Schedule & Notify (${selectedAgentIds.size})`
                    : 'Schedule Showing'}
                </>
              )}
            </button>
          )}
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

// ─────────────────────────── Notify Agent Network section ───────────────────────────
function NotifyAgentSection({
  agents, agentsLoaded, selectedIds, setSelectedIds,
  previewOpen, setPreviewOpen, form,
}) {
  const allSelected = agents.length > 0 && selectedIds.size === agents.length

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(agents.map((a) => a.id)))
  }

  const toggleOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  return (
    <div className="rounded-xl border border-navy/[0.08] bg-white p-4">
      <div className="flex items-center gap-2">
        <MailIcon className="w-4 h-4 text-gold-dark" />
        <p className="font-semibold text-sm text-navy">Notify Agent Network</p>
      </div>

      {!agentsLoaded ? (
        <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
      ) : agents.length === 0 ? (
        <div className="mt-3 bg-cream rounded-xl p-3">
          <p className="text-muted text-xs leading-relaxed">
            No agents in your network yet.{' '}
            <Link to="/agent-network" className="text-gold-dark font-semibold hover:text-gold transition-colors">
              Add agents in Agent Network →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* Header — count + select all */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-muted text-xs">
              <span className="text-navy font-semibold">{selectedIds.size}</span>{' '}
              of {agents.length} selected
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-gold-dark hover:text-gold transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Agent checkboxes */}
          <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-navy/[0.06] divide-y divide-navy/[0.04]">
            {agents.map((a) => {
              const checked = selectedIds.has(a.id)
              return (
                <li key={a.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-cream/60 transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleOne(a.id)}
                      className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                        checked ? 'bg-gold border-gold' : 'border-navy/20 bg-white'
                      }`}
                      aria-pressed={checked}
                    >
                      {checked && <CheckIcon className="w-3 h-3 text-navy" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-navy font-semibold text-sm truncate">{a.full_name}</p>
                      <p className="text-muted text-[11px] truncate">
                        {a.email}{a.brokerage && ` · ${a.brokerage}`}
                      </p>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>

          {/* Preview */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="text-xs font-semibold text-gold-dark hover:text-gold transition-colors mt-3 flex items-center gap-1"
            >
              {previewOpen ? '−' : '+'} Email preview
            </button>
          )}

          {previewOpen && selectedIds.size > 0 && (
            <EmailPreview form={form} />
          )}
        </>
      )}
    </div>
  )
}

function EmailPreview({ form }) {
  const subject = `Showing Scheduled — ${form.property_address || '…'}`
  return (
    <div className="mt-3 bg-cream rounded-xl border border-navy/[0.06] overflow-hidden">
      <div className="px-4 py-2 border-b border-navy/[0.06] bg-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Subject</p>
        <p className="text-sm text-navy font-semibold truncate mt-0.5">{subject}</p>
      </div>
      <div className="p-4 text-sm text-navy/80 leading-relaxed">
        <p>A showing has been scheduled. Please inform your clients who may be interested.</p>
        <div className="mt-3 bg-white rounded-lg p-3 border border-navy/[0.05] space-y-1 text-xs">
          <p><strong>Property:</strong> {form.property_address || '—'}</p>
          <p><strong>Date:</strong> {form.showing_date || '—'}</p>
          <p><strong>Time:</strong> {form.showing_time || 'Time TBD'}</p>
          {form.client_name && <p><strong>Showing For:</strong> {form.client_name}</p>}
          {form.notes && <p><strong>Notes:</strong> {form.notes}</p>}
        </div>
        <p className="text-muted text-xs mt-3 italic">
          The full email includes your contact info and DealFlow branding.
        </p>
      </div>
    </div>
  )
}
