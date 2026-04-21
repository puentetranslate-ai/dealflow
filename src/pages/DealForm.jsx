import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PHASES, DEFAULT_CHECKLIST } from '../lib/constants'
import { formatCurrency, calcCommission } from '../lib/utils'
import LoadingSpinner from '../components/LoadingSpinner'

const BLANK = {
  address: '',
  sale_price: '',
  agent_role: 'buyer',
  commission_pct: '',
  phase: 'Offer Accepted',
  offer_date: '',
  closing_date: '',
  buyer_name: '',
  buyer_phone: '',
  buyer_email: '',
  seller_name: '',
  seller_phone: '',
  seller_email: '',
  notes: '',
}

export default function DealForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(BLANK)
  const [originalPhase, setOriginalPhase] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isEdit) {
      fetchDeal()
    } else {
      loadDefaultCommission()
    }
  }, [id])

  const loadDefaultCommission = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('default_commission_pct')
      .eq('id', user.id)
      .single()
    if (data?.default_commission_pct != null) {
      setForm((f) => ({ ...f, commission_pct: String(data.default_commission_pct) }))
    }
  }

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

    setOriginalPhase(data.phase)
    setForm({
      address: data.address || '',
      sale_price: data.sale_price != null ? String(data.sale_price) : '',
      agent_role: data.agent_role || 'buyer',
      commission_pct: data.commission_pct != null ? String(data.commission_pct) : '',
      phase: data.phase || 'Offer Accepted',
      offer_date: data.offer_date || '',
      closing_date: data.closing_date || '',
      buyer_name: data.buyer_name || '',
      buyer_phone: data.buyer_phone || '',
      buyer_email: data.buyer_email || '',
      seller_name: data.seller_name || '',
      seller_phone: data.seller_phone || '',
      seller_email: data.seller_email || '',
      notes: data.notes || '',
    })
    setLoading(false)
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const commissionDollar = calcCommission(form.sale_price, form.commission_pct)

  const handleSave = async () => {
    if (!form.address.trim()) {
      setError('Property address is required.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const phaseChanged = isEdit && form.phase !== originalPhase

      const payload = {
        address: form.address.trim(),
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        agent_role: form.agent_role,
        commission_pct: form.commission_pct ? parseFloat(form.commission_pct) : null,
        phase: form.phase,
        offer_date: form.offer_date || null,
        closing_date: form.closing_date || null,
        buyer_name: form.buyer_name || null,
        buyer_phone: form.buyer_phone || null,
        buyer_email: form.buyer_email || null,
        seller_name: form.seller_name || null,
        seller_phone: form.seller_phone || null,
        seller_email: form.seller_email || null,
        notes: form.notes || null,
        updated_at: now,
        ...(phaseChanged ? { phase_changed_at: now } : {}),
      }

      if (isEdit) {
        const { error } = await supabase
          .from('deals')
          .update(payload)
          .eq('id', id)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('deals')
          .insert({ ...payload, user_id: user.id, phase_changed_at: now, created_at: now })
          .select()
          .single()
        if (error) throw error
        await seedChecklist(data.id)
      }

      navigate(-1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const seedChecklist = async (dealId) => {
    const items = []
    for (const [phase, labels] of Object.entries(DEFAULT_CHECKLIST)) {
      for (const label of labels) {
        items.push({ deal_id: dealId, user_id: user.id, label, phase, is_checked: false })
      }
    }
    const { error } = await supabase.from('checklist_items').insert(items)
    if (error) console.warn('Checklist seed failed:', error.message)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-10">
      <div className="bg-navy px-4 pt-14 pb-4 flex items-center justify-between sticky top-0 z-40">
        <button
          onClick={() => navigate(-1)}
          className="text-muted flex items-center gap-1 min-h-[44px] pr-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Cancel</span>
        </button>
        <h1 className="font-display text-lg font-bold text-white">
          {isEdit ? 'Edit Deal' : 'New Deal'}
        </h1>
        <div className="w-16" />
      </div>

      <div className="px-4 pt-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Property Info */}
        <section>
          <p className="section-title">Property</p>
          <div className="space-y-3">
            <div>
              <label className="label">Property Address *</label>
              <input
                type="text"
                value={form.address}
                onChange={set('address')}
                className="input-field"
                placeholder="123 Main St, Tampa, FL 33601"
              />
            </div>

            <div>
              <label className="label">Sale Price</label>
              <input
                type="number"
                value={form.sale_price}
                onChange={set('sale_price')}
                className="input-field"
                placeholder="450000"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="label">Agent Role</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {['buyer', 'seller'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, agent_role: role }))}
                    className={`flex-1 py-3 font-semibold text-sm transition-colors ${
                      form.agent_role === role
                        ? 'bg-navy text-white'
                        : 'bg-white text-muted'
                    }`}
                  >
                    {role === 'buyer' ? "Buyer's Agent" : 'Listing Agent'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Commission %</label>
              <input
                type="number"
                value={form.commission_pct}
                onChange={set('commission_pct')}
                className="input-field"
                placeholder="3.0"
                inputMode="decimal"
                step="0.1"
              />
            </div>

            {commissionDollar > 0 && (
              <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-navy text-sm font-medium">Estimated Commission</span>
                <span className="text-navy font-bold text-lg">{formatCurrency(commissionDollar)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <p className="section-title">Timeline</p>
          <div className="space-y-3">
            <div>
              <label className="label">Current Phase</label>
              <select value={form.phase} onChange={set('phase')} className="input-field">
                {PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Offer Date</label>
                <input type="date" value={form.offer_date} onChange={set('offer_date')} className="input-field" />
              </div>
              <div>
                <label className="label">Closing Date</label>
                <input type="date" value={form.closing_date} onChange={set('closing_date')} className="input-field" />
              </div>
            </div>
          </div>
        </section>

        {/* Buyer */}
        <section>
          <p className="section-title">Buyer</p>
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input type="text" value={form.buyer_name} onChange={set('buyer_name')} className="input-field" placeholder="John Buyer" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.buyer_phone} onChange={set('buyer_phone')} className="input-field" placeholder="(813) 555-0100" inputMode="tel" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.buyer_email} onChange={set('buyer_email')} className="input-field" placeholder="buyer@email.com" />
            </div>
          </div>
        </section>

        {/* Seller */}
        <section>
          <p className="section-title">Seller</p>
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input type="text" value={form.seller_name} onChange={set('seller_name')} className="input-field" placeholder="Jane Seller" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.seller_phone} onChange={set('seller_phone')} className="input-field" placeholder="(813) 555-0200" inputMode="tel" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.seller_email} onChange={set('seller_email')} className="input-field" placeholder="seller@email.com" />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <p className="section-title">Notes</p>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            className="input-field resize-none"
            rows={4}
            placeholder="Any notes about this transaction…"
          />
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? <LoadingSpinner size="sm" /> : isEdit ? 'Save Changes' : 'Create Deal'}
        </button>

        <div className="h-4" />
      </div>
    </div>
  )
}
