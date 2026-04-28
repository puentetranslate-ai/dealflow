import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  TEMPERATURES, TEMP_STYLES, TEMP_DESCRIPTIONS, INTEREST_TYPES, SOURCES,
} from '../lib/leadConstants'
import AppLayout from '../components/AppLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  CheckIcon, ArrowLeftIcon, UsersIcon, FunnelIcon, MailIcon, PhoneIcon, CalendarIcon,
} from '../components/Icon'

const BLANK = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  source: 'Other',
  referrer_name: '',
  temperature: 'Warm',
  interest_type: 'Buying',
  budget_min: '',
  budget_max: '',
  target_area: '',
  notes: '',
  follow_up_date: '',
}

export default function LeadForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(BLANK)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (isEdit) fetchLead() }, [id])

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from('leads').select('*').eq('id', id).eq('user_id', user.id).single()
    if (error || !data) {
      navigate('/leads', { replace: true })
      return
    }
    setForm({
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      phone: data.phone || '',
      email: data.email || '',
      source: data.source || 'Other',
      referrer_name: data.referrer_name || '',
      temperature: data.temperature || 'Warm',
      interest_type: data.interest_type || 'Buying',
      budget_min: data.budget_min != null ? String(data.budget_min) : '',
      budget_max: data.budget_max != null ? String(data.budget_max) : '',
      target_area: data.target_area || '',
      notes: data.notes || '',
      follow_up_date: data.follow_up_date || '',
    })
    setLoading(false)
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.')
      return
    }
    setSaving(true); setError(null)

    const now = new Date().toISOString()
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      referrer_name: form.source === 'Referral' ? (form.referrer_name || null) : null,
      temperature: form.temperature,
      interest_type: form.interest_type,
      budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
      budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      target_area: form.target_area || null,
      notes: form.notes || null,
      follow_up_date: form.follow_up_date || null,
      updated_at: now,
    }

    try {
      if (isEdit) {
        const { error } = await supabase.from('leads').update(payload).eq('id', id).eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('leads').insert({
          ...payload,
          user_id: user.id,
          created_at: now,
        })
        if (error) throw error
      }
      navigate('/leads')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Header */}
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
            <span className="text-xs font-semibold text-white/60 tracking-wider">
              {isEdit ? 'Edit' : 'Step 1 of 1'}
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-3 leading-tight">
            {isEdit ? 'Edit ' : 'New '}
            <span className="text-gold">Lead</span>
          </h1>
          <p className="text-white/60 text-sm mt-1.5">
            {isEdit ? 'Update lead details.' : 'Capture a prospect before they become a deal.'}
          </p>
        </div>
      </header>

      <div className="px-5 md:px-8 pt-6 pb-32 md:pb-12 max-w-3xl">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Contact */}
          <Section icon={<UsersIcon className="w-4 h-4" />} title="Contact Info" subtitle="Who is this lead?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First Name" required>
                <input type="text" value={form.first_name} onChange={set('first_name')} className="input-field" placeholder="Jane" />
              </Field>
              <Field label="Last Name" required>
                <input type="text" value={form.last_name} onChange={set('last_name')} className="input-field" placeholder="Doe" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone">
                <div className="relative">
                  <PhoneIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="tel" value={form.phone} onChange={set('phone')} className="input-with-icon" placeholder="(813) 555-0100" inputMode="tel" />
                </div>
              </Field>
              <Field label="Email">
                <div className="relative">
                  <MailIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="email" value={form.email} onChange={set('email')} className="input-with-icon" placeholder="email@example.com" />
                </div>
              </Field>
            </div>
          </Section>

          {/* Lead details */}
          <Section icon={<FunnelIcon className="w-4 h-4" />} title="Lead Details" subtitle="What are they looking for?">
            <div>
              <label className="label">Interest Type</label>
              <div className="grid grid-cols-2 gap-3">
                {INTEREST_TYPES.map((t) => (
                  <ToggleCard
                    key={t}
                    active={form.interest_type === t}
                    onClick={() => setForm((f) => ({ ...f, interest_type: t }))}
                    title={t}
                    subtitle={t === 'Buying' ? 'Looking to purchase' : 'Looking to sell'}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="label">Temperature</label>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {TEMPERATURES.map((temp) => (
                  <TempCard
                    key={temp}
                    temp={temp}
                    active={form.temperature === temp}
                    onClick={() => setForm((f) => ({ ...f, temperature: temp }))}
                  />
                ))}
              </div>
            </div>

            <Field label="Source">
              <select value={form.source} onChange={set('source')} className="input-field appearance-none">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            {form.source === 'Referral' && (
              <Field label="Referred by">
                <input
                  type="text"
                  value={form.referrer_name}
                  onChange={set('referrer_name')}
                  className="input-field"
                  placeholder="Name of the referring person"
                />
              </Field>
            )}
          </Section>

          {/* Budget + area */}
          <Section title="Property &amp; Budget" subtitle="What's their target?">
            <Field label="Target Area">
              <input
                type="text"
                value={form.target_area}
                onChange={set('target_area')}
                className="input-field"
                placeholder="South Tampa, 33611, or a neighborhood…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Budget Min">
                <DollarInput value={form.budget_min} onChange={set('budget_min')} placeholder="350,000" />
              </Field>
              <Field label="Budget Max">
                <DollarInput value={form.budget_max} onChange={set('budget_max')} placeholder="500,000" />
              </Field>
            </div>
          </Section>

          {/* Follow-up */}
          <Section icon={<CalendarIcon className="w-4 h-4" />} title="Follow Up" subtitle="When and what to remember">
            <Field label="Follow-up Date">
              <input type="date" value={form.follow_up_date} onChange={set('follow_up_date')} className="input-field" />
            </Field>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={set('notes')}
                className="input-field resize-none"
                rows={5}
                placeholder="Conversation history, lender info, timeline, deal-breakers…"
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[280px] z-40 bg-white border-t border-navy/[0.06] pb-safe">
        <div className="px-5 md:px-8 py-4 max-w-3xl">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <CheckIcon className="w-5 h-5 mr-2" strokeWidth={2.5} />
                {isEdit ? 'Save Changes' : 'Save Lead'}
              </>
            )}
          </button>
          <p className="text-center text-muted text-xs mt-2">
            You can edit everything later from the leads page.
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

function ToggleCard({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left p-4 rounded-xl border-2 transition-all min-h-[72px] ${
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

function TempCard({ temp, active, onClick }) {
  const style = TEMP_STYLES[temp]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-center p-3 md:p-4 rounded-xl border-2 transition-all min-h-[88px] ${
        active
          ? `${style.soft} border-gold shadow-card`
          : 'bg-white border-navy/10 hover:border-gold/40'
      }`}
    >
      <span
        className="block w-3 h-3 rounded-full mx-auto"
        style={{ backgroundColor: style.hex }}
      />
      <p className="font-display text-base font-bold text-navy mt-2 leading-none">{temp}</p>
      <p className="text-muted text-[10px] leading-tight mt-1">{TEMP_DESCRIPTIONS[temp]}</p>
    </button>
  )
}

function DollarInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">$</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="input-field pl-8"
        placeholder={placeholder}
        inputMode="numeric"
      />
    </div>
  )
}
