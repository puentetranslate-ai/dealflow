import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PHASES, PHASE_STYLES, DEFAULT_CHECKLIST } from '../lib/constants'
import { formatCurrency, calcCommission } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import { CheckIcon, ArrowLeftIcon, UsersIcon, HomeIcon, FunnelIcon } from '../components/Icon'

const BLANK = {
  address: '',
  sale_price: '',
  agent_role: 'buyer',
  commission_pct: '',
  phase: 'Offer Accepted',
  offer_date: '',
  closing_date: '',
  buyer_name: '', buyer_phone: '', buyer_email: '',
  seller_name: '', seller_phone: '', seller_email: '',
  notes: '',
}

export default function DealForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const fromLeadId = searchParams.get('fromLead')
  const [form, setForm] = useState(BLANK)
  const [originalPhase, setOriginalPhase] = useState(null)
  const [loading, setLoading] = useState(isEdit || Boolean(fromLeadId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [sourceLead, setSourceLead] = useState(null)

  useEffect(() => {
    if (isEdit) {
      fetchDeal()
    } else if (fromLeadId) {
      prefillFromLead(fromLeadId)
    } else {
      loadDefaultCommission()
    }
  }, [id, fromLeadId])

  const loadDefaultCommission = async () => {
    const { data } = await supabase
      .from('profiles').select('default_commission_pct')
      .eq('id', user.id).single()
    if (data?.default_commission_pct != null) {
      setForm((f) => ({ ...f, commission_pct: String(data.default_commission_pct) }))
    }
  }

  const prefillFromLead = async (leadId) => {
    const [leadRes, profileRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).eq('user_id', user.id).single(),
      supabase.from('profiles').select('default_commission_pct').eq('id', user.id).single(),
    ])
    const lead = leadRes.data
    if (!lead) {
      navigate('/leads', { replace: true })
      return
    }
    setSourceLead(lead)
    const isBuyerSide = lead.interest_type === 'Buying'
    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    setForm((f) => ({
      ...f,
      agent_role: isBuyerSide ? 'buyer' : 'seller',
      commission_pct: profileRes.data?.default_commission_pct != null
        ? String(profileRes.data.default_commission_pct)
        : f.commission_pct,
      buyer_name: isBuyerSide ? fullName : '',
      buyer_phone: isBuyerSide ? (lead.phone || '') : '',
      buyer_email: isBuyerSide ? (lead.email || '') : '',
      seller_name: !isBuyerSide ? fullName : '',
      seller_phone: !isBuyerSide ? (lead.phone || '') : '',
      seller_email: !isBuyerSide ? (lead.email || '') : '',
      notes: lead.notes || '',
      address: lead.target_area ? lead.target_area : f.address,
    }))
    setLoading(false)
  }

  const fetchDeal = async () => {
    const { data, error } = await supabase
      .from('deals').select('*').eq('id', id).eq('user_id', user.id).single()
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
    if (!form.address.trim()) { setError('Property address is required.'); return }
    setSaving(true); setError(null)
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
        const { error } = await supabase.from('deals').update(payload).eq('id', id).eq('user_id', user.id)
        if (error) throw error
        navigate(-1)
      } else {
        const { data, error } = await supabase.from('deals')
          .insert({ ...payload, user_id: user.id, phase_changed_at: now, created_at: now })
          .select().single()
        if (error) throw error
        await seedChecklist(data.id)

        // If this deal was spawned from a lead, mark the lead as converted
        // and route the agent to the new deal so they see the result of the convert.
        if (sourceLead) {
          await supabase
            .from('leads')
            .update({ converted_to_deal_id: data.id, updated_at: now })
            .eq('id', sourceLead.id)
            .eq('user_id', user.id)
          navigate(`/deals/${data.id}`, { replace: true })
        } else {
          navigate(-1)
        }
      }
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
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* ── Header (mobile + desktop, navy with gold-grid texture) ── */}
      <header className="bg-navy text-white pt-safe gold-grid-bg">
        <div className="px-5 md:px-8 pt-6 pb-7">
          <div className="flex items-center justify-between min-h-[36px]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium -ml-2 px-2 py-2 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Cancel
            </button>
            <span className="text-xs font-semibold text-white/60 tracking-wider">Step 1 of 1</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-3 leading-tight">
            {isEdit ? 'Edit ' : 'New '}
            <span className="text-gold">Deal</span>
          </h1>
          <p className="text-white/60 text-sm mt-1.5">
            {isEdit ? 'Update transaction details.' : 'Start tracking a new transaction in your pipeline.'}
          </p>
        </div>
      </header>

      <div className="px-5 md:px-8 pt-6 pb-32 md:pb-12 max-w-3xl">
        {sourceLead && (
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gold/20 text-gold-dark flex items-center justify-center shrink-0">
              <FunnelIcon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-navy text-sm font-semibold">
                Converting from lead: {sourceLead.first_name} {sourceLead.last_name}
              </p>
              <p className="text-muted text-xs">
                We prefilled what we knew. Add the property address and any missing fields, then save.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Property */}
          <Section icon={<HomeIcon className="w-4 h-4" />} title="Property" subtitle="Where is the deal?">
            <Field label="Property Address" required>
              <input
                type="text"
                value={form.address}
                onChange={set('address')}
                className="input-field"
                placeholder="123 Main St, Tampa, FL 33601"
              />
            </Field>

            <Field label="Sale Price">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">$</span>
                <input
                  type="number"
                  value={form.sale_price}
                  onChange={set('sale_price')}
                  className="input-field pl-8"
                  placeholder="450,000"
                  inputMode="numeric"
                />
              </div>
            </Field>
          </Section>

          {/* Agent Role */}
          <Section icon={<UsersIcon className="w-4 h-4" />} title="Agent Role" subtitle="Which side are you on?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RoleCard
                active={form.agent_role === 'buyer'}
                onClick={() => setForm((f) => ({ ...f, agent_role: 'buyer' }))}
                title="Buyer's Agent"
                subtitle="Representing the buyer"
              />
              <RoleCard
                active={form.agent_role === 'seller'}
                onClick={() => setForm((f) => ({ ...f, agent_role: 'seller' }))}
                title="Listing Agent"
                subtitle="Representing the seller"
              />
            </div>
          </Section>

          {/* Commission */}
          <Section title="Commission" subtitle="Your share of this transaction">
            <Field label="Commission %">
              <div className="relative">
                <input
                  type="number"
                  value={form.commission_pct}
                  onChange={set('commission_pct')}
                  className="input-field pr-10"
                  placeholder="3.0"
                  inputMode="decimal"
                  step="0.1"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">%</span>
              </div>
            </Field>

            {(form.sale_price || form.commission_pct) && (
              <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gold-dark uppercase tracking-wider">Estimated Commission</p>
                  <p className="text-navy/70 text-xs truncate mt-0.5">
                    {form.commission_pct || 0}% of {formatCurrency(parseFloat(form.sale_price) || 0)}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold text-gold-dark whitespace-nowrap">
                  {formatCurrency(commissionDollar)}
                </p>
              </div>
            )}
          </Section>

          {/* Timeline */}
          <Section title="Timeline" subtitle="Phase and key dates">
            <Field label="Current Phase">
              <PhaseSelect value={form.phase} onChange={(v) => setForm((f) => ({ ...f, phase: v }))} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Offer Date">
                <input type="date" value={form.offer_date} onChange={set('offer_date')} className="input-field" />
              </Field>
              <Field label="Closing Date">
                <input type="date" value={form.closing_date} onChange={set('closing_date')} className="input-field" />
              </Field>
            </div>
          </Section>

          {/* Buyer */}
          <Section title="Buyer" subtitle="Buyer's contact info">
            <ContactFields prefix="buyer" form={form} setForm={setForm} placeholderName="John Buyer" />
          </Section>

          {/* Seller */}
          <Section title="Seller" subtitle="Seller's contact info">
            <ContactFields prefix="seller" form={form} setForm={setForm} placeholderName="Jane Seller" />
          </Section>

          {/* Notes */}
          <Section title="Notes" subtitle="Anything else worth tracking?">
            <textarea
              value={form.notes}
              onChange={set('notes')}
              className="input-field resize-none"
              rows={4}
              placeholder="Lender contact, contingency info, special clauses…"
            />
          </Section>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[280px] z-40 bg-white border-t border-navy/[0.06] pb-safe">
        <div className="px-5 md:px-8 py-4 max-w-3xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <CheckIcon className="w-5 h-5 mr-2" strokeWidth={2.5} />
                {isEdit ? 'Save Changes' : 'Save Deal'}
              </>
            )}
          </button>
          <p className="text-center text-muted text-xs mt-2">
            You can edit everything later from the deal page.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

// ─────────────────────────── Sub-components ───────────────────────────
function Section({ title, subtitle, icon, children }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        {icon && (
          <span className="w-8 h-8 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center shrink-0 mt-0.5">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-navy leading-tight">{title}</h3>
          {subtitle && <p className="text-muted text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-gold-dark ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function RoleCard({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left p-4 rounded-xl border-2 transition-all ${
        active
          ? 'bg-gold/15 border-gold shadow-card'
          : 'bg-white border-navy/10 hover:border-gold/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-display text-base font-bold text-navy">{title}</h4>
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          active ? 'bg-gold border-gold' : 'border-navy/20'
        }`}>
          {active && <CheckIcon className="w-3 h-3 text-navy" strokeWidth={3} />}
        </span>
      </div>
      <p className="text-muted text-xs mt-1">{subtitle}</p>
    </button>
  )
}

function PhaseSelect({ value, onChange }) {
  const style = PHASE_STYLES[value]
  return (
    <div className="relative">
      <span className={`absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${style.dot} pointer-events-none`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field pl-10 pr-4 appearance-none cursor-pointer"
      >
        {PHASES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

function ContactFields({ prefix, form, setForm, placeholderName }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  return (
    <>
      <Field label="Name">
        <input
          type="text"
          value={form[`${prefix}_name`]}
          onChange={set(`${prefix}_name`)}
          className="input-field"
          placeholder={placeholderName}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phone">
          <input
            type="tel"
            value={form[`${prefix}_phone`]}
            onChange={set(`${prefix}_phone`)}
            className="input-field"
            placeholder="(813) 555-0100"
            inputMode="tel"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form[`${prefix}_email`]}
            onChange={set(`${prefix}_email`)}
            className="input-field"
            placeholder="email@example.com"
          />
        </Field>
      </div>
    </>
  )
}
