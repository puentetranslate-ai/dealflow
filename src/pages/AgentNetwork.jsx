import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  PlusIcon, SearchIcon, PhoneIcon, MailIcon, TrashIcon, UsersIcon, XIcon, CheckIcon,
} from '../components/Icon'

export default function AgentNetwork() {
  const { user } = useAuth()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingAgent, setEditingAgent] = useState(null)  // null | 'new' | <agent row>
  const [error, setError] = useState(null)

  const fetchAgents = async () => {
    setLoading(true)
    const { data, error: dbErr } = await supabase
      .from('agent_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('full_name', { ascending: true })
    if (!dbErr) setAgents(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAgents() }, [user.id])

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter((a) =>
      a.full_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.includes(q) ||
      a.brokerage?.toLowerCase().includes(q)
    )
  }, [agents, search])

  const handleSaved = (saved) => {
    setAgents((prev) => {
      const existing = prev.findIndex((a) => a.id === saved.id)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = saved
        return next
      }
      return [...prev, saved].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      )
    })
  }

  const handleDelete = async (agent) => {
    if (!confirm(`Remove "${agent.full_name}" from your network?`)) return
    setAgents((prev) => prev.filter((a) => a.id !== agent.id))
    const { error: dbErr } = await supabase
      .from('agent_contacts')
      .delete().eq('id', agent.id).eq('user_id', user.id)
    if (dbErr) {
      setError(dbErr.message)
      // Restore on failure
      setAgents((prev) => [...prev, agent].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      ))
    }
  }

  return (
    <AppLayout>
      <MobileHeader
        eyebrow="Network"
        title={`Agents (${agents.length})`}
        rightSlot={
          <button
            onClick={() => setEditingAgent('new')}
            className="w-9 h-9 bg-gold text-navy rounded-full flex items-center justify-center"
            aria-label="Add agent"
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
            placeholder="Search agents…"
            className="w-full bg-white/[0.08] text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white/[0.14] transition-colors"
          />
        </div>
      </MobileHeader>

      <TopBar search={search} onSearchChange={setSearch} searchPlaceholder="Search agents…" />

      <div className="hidden md:flex items-center justify-between px-8 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Network</p>
          <h1 className="font-display text-3xl font-bold text-navy mt-1">
            Agent Network <span className="text-muted font-medium">({agents.length})</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Agents you work with. Notify them instantly when you schedule a showing.
          </p>
        </div>
        <button
          onClick={() => setEditingAgent('new')}
          className="bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-5 h-10 flex items-center gap-2 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      <div className="md:hidden px-5 pt-4">
        <p className="text-muted text-sm">
          Agents you work with. Notify them instantly when you schedule a showing.
        </p>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <Empty hasAny={agents.length > 0} search={search} onAdd={() => setEditingAgent('new')} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onEdit={() => setEditingAgent(a)}
                  onDelete={() => handleDelete(a)}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-navy/[0.03] border-b border-navy/[0.06]">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Brokerage</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/[0.05]">
                  {filtered.map((a) => (
                    <AgentRow
                      key={a.id}
                      agent={a}
                      onEdit={() => setEditingAgent(a)}
                      onDelete={() => handleDelete(a)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {editingAgent !== null && (
        <AgentFormModal
          agent={editingAgent === 'new' ? null : editingAgent}
          onClose={() => setEditingAgent(null)}
          onSaved={(saved) => { handleSaved(saved); setEditingAgent(null) }}
        />
      )}
    </AppLayout>
  )
}

// ─────────────────────────── Cards / rows ───────────────────────────
function AgentCard({ agent, onEdit, onDelete }) {
  const initials = (agent.full_name || '?').split(/\s+/).slice(0, 2)
    .map((s) => s[0]).join('').toUpperCase()

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-navy text-gold font-bold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-navy leading-tight">
            {agent.full_name}
          </h3>
          {agent.brokerage && (
            <p className="text-muted text-xs mt-0.5">{agent.brokerage}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-gold-dark hover:text-gold rounded-lg px-2 h-8 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            aria-label="Remove"
            className="w-8 h-8 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(agent.email || agent.phone) && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              className="flex items-center justify-center gap-2 bg-gold/15 hover:bg-gold/25 text-gold-dark rounded-xl min-h-[44px] text-xs font-semibold transition-colors px-3 truncate"
            >
              <MailIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">Email</span>
            </a>
          )}
          {agent.phone && (
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center justify-center gap-2 bg-navy/[0.04] hover:bg-navy/[0.08] text-navy rounded-xl min-h-[44px] text-xs font-semibold transition-colors px-3 truncate"
            >
              <PhoneIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{agent.phone}</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function AgentRow({ agent, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-cream/60 transition-colors">
      <td className="px-5 py-3 font-semibold text-navy">{agent.full_name}</td>
      <td className="px-5 py-3 text-navy/80">{agent.brokerage || '—'}</td>
      <td className="px-5 py-3">
        {agent.email ? (
          <a href={`mailto:${agent.email}`} className="text-navy hover:text-gold-dark transition-colors">
            {agent.email}
          </a>
        ) : '—'}
      </td>
      <td className="px-5 py-3">
        {agent.phone ? (
          <a href={`tel:${agent.phone}`} className="text-navy hover:text-gold-dark transition-colors">
            {agent.phone}
          </a>
        ) : '—'}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="px-3 h-8 rounded-lg text-xs font-semibold text-navy hover:bg-navy/[0.06] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            aria-label="Remove"
            className="w-8 h-8 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────── Empty state ───────────────────────────
function Empty({ hasAny, search, onAdd }) {
  if (search) {
    return (
      <div className="text-center py-16">
        <p className="text-navy font-semibold">No matches found</p>
        <p className="text-muted text-sm mt-1">Try a different search term.</p>
      </div>
    )
  }
  if (hasAny) return null
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-3">
        <UsersIcon className="w-7 h-7 text-navy/30" />
      </div>
      <p className="text-navy font-semibold">No agents in your network yet</p>
      <p className="text-muted text-sm mt-1 max-w-sm mx-auto">
        Add agents you work with to notify them when you schedule showings.
      </p>
      <button onClick={onAdd} className="btn-primary mt-5 inline-flex w-auto px-6">
        <PlusIcon className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
        Add Your First Agent
      </button>
    </div>
  )
}

// ─────────────────────────── Add/Edit modal ───────────────────────────
function AgentFormModal({ agent, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(agent)
  const [form, setForm] = useState(() => ({
    full_name: agent?.full_name || '',
    email:     agent?.email     || '',
    phone:     agent?.phone     || '',
    brokerage: agent?.brokerage || '',
    notes:     agent?.notes     || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    setSaving(true); setError(null)

    const payload = {
      user_id: user.id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      brokerage: form.brokerage.trim() || null,
      notes: form.notes.trim() || null,
    }

    let result
    if (isEdit) {
      result = await supabase
        .from('agent_contacts').update(payload)
        .eq('id', agent.id).eq('user_id', user.id)
        .select().single()
    } else {
      result = await supabase
        .from('agent_contacts').insert(payload)
        .select().single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSaved(result.data)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:w-[480px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-3 border-b border-navy/[0.06]">
          <h2 className="font-display text-lg font-bold text-navy">
            {isEdit ? 'Edit Agent' : 'Add Agent'}
          </h2>
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

          <Field label="Full name" required>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="input-field"
              placeholder="Jane Smith"
              autoFocus
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
              placeholder="jane@brokerage.com"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="(813) 555-0100"
                inputMode="tel"
              />
            </Field>
            <Field label="Brokerage">
              <input
                type="text"
                value={form.brokerage}
                onChange={(e) => setForm((f) => ({ ...f, brokerage: e.target.value }))}
                className="input-field"
                placeholder="Coldwell Banker, Compass…"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none"
              rows={3}
              placeholder="What kind of clients they have, areas they cover…"
            />
          </Field>
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-navy/[0.06] flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <LoadingSpinner size="sm" /> : (
              <>
                <CheckIcon className="w-5 h-5 mr-1.5" strokeWidth={2.5} />
                {isEdit ? 'Save' : 'Add Agent'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
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
