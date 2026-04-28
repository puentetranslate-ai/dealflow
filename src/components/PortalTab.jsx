import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate, isPastDue } from '../lib/utils'
import LoadingSpinner from './LoadingSpinner'
import {
  LockIcon, CopyIcon, ShareIcon, CheckIcon, TrashIcon, LinkIcon, PlusIcon, CalendarIcon,
} from './Icon'

const BUYER_TASKS = [
  'Get pre-approval letter',
  'Provide proof of funds',
  'Schedule home inspection',
  "Get homeowner's insurance quotes",
  'Complete final walkthrough',
  'Wire closing funds',
  'Bring valid ID to closing',
]

const SELLER_TASKS = [
  "Complete seller's disclosure form",
  'Remove personal items before inspection',
  'Make agreed repairs',
  'Vacate property for showings',
  'Review closing disclosure',
  'Hand over all keys and garage openers',
  'Cancel utilities on closing day',
]

// Agent-side Portal management tab. Renders inside DealDetail.
// Receives the deal so it can prefill agent contact info on portal creation.

export default function PortalTab({ deal, onUnreadChange }) {
  const { user } = useAuth()
  const [portals, setPortals] = useState([])
  const [tasksByPortal, setTasksByPortal] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(null) // 'buyer' | 'seller' | null

  // ─── Load portals + tasks ───
  const fetchAll = async () => {
    setLoading(true)
    const { data: portalRows, error: pErr } = await supabase
      .from('client_portals')
      .select('*')
      .eq('deal_id', deal.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (pErr) { setError(pErr.message); setLoading(false); return }
    setPortals(portalRows || [])

    if ((portalRows || []).length > 0) {
      const ids = portalRows.map((p) => p.id)
      const { data: taskRows } = await supabase
        .from('client_tasks')
        .select('*')
        .in('portal_id', ids)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      const grouped = {}
      ;(taskRows || []).forEach((t) => {
        if (!grouped[t.portal_id]) grouped[t.portal_id] = []
        grouped[t.portal_id].push(t)
      })
      setTasksByPortal(grouped)
    } else {
      setTasksByPortal({})
    }

    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [deal.id])

  // Mark this tab as viewed so Portal-tab badge resets (DealDetail reads this)
  useEffect(() => {
    localStorage.setItem(`portal-viewed:${deal.id}`, new Date().toISOString())
    onUnreadChange?.(0)
  }, [deal.id])

  const buyerPortal = portals.find((p) => p.client_type === 'buyer')
  const sellerPortal = portals.find((p) => p.client_type === 'seller')

  // ─── Create portal ───
  const handleCreate = async (clientType) => {
    setCreating(clientType)
    setError(null)
    const clientName = clientType === 'buyer' ? deal.buyer_name : deal.seller_name
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    const agentName = profile?.full_name || user.user_metadata?.full_name || ''

    const { data, error } = await supabase
      .from('client_portals')
      .insert({
        deal_id: deal.id,
        user_id: user.id,
        client_name: clientName || null,
        client_type: clientType,
        agent_name: agentName,
        agent_email: user.email,
        agent_phone: null,
      })
      .select().single()

    if (error) setError(error.message)
    else setPortals((prev) => [...prev, data])
    setCreating(null)
  }

  const handleToggleActive = async (portal) => {
    const newVal = !portal.is_active
    setPortals((prev) => prev.map((p) => p.id === portal.id ? { ...p, is_active: newVal } : p))
    await supabase.from('client_portals')
      .update({ is_active: newVal })
      .eq('id', portal.id).eq('user_id', user.id)
  }

  const handleAgentPhoneSave = async (portal, phone) => {
    setPortals((prev) => prev.map((p) => p.id === portal.id ? { ...p, agent_phone: phone || null } : p))
    await supabase.from('client_portals')
      .update({ agent_phone: phone || null })
      .eq('id', portal.id).eq('user_id', user.id)
  }

  // ─── Tasks ───
  const handleAddTask = async (portalId, payload) => {
    const { data, error } = await supabase
      .from('client_tasks')
      .insert({
        deal_id: deal.id,
        portal_id: portalId,
        user_id: user.id,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        due_date: payload.due_date || null,
      })
      .select().single()
    if (error) { setError(error.message); return }
    setTasksByPortal((prev) => ({
      ...prev,
      [portalId]: [...(prev[portalId] || []), data],
    }))
  }

  const handleToggleTask = async (task) => {
    const newVal = !task.is_completed
    const completedAt = newVal ? new Date().toISOString() : null
    setTasksByPortal((prev) => ({
      ...prev,
      [task.portal_id]: prev[task.portal_id].map((t) =>
        t.id === task.id ? { ...t, is_completed: newVal, completed_at: completedAt } : t
      ),
    }))
    await supabase.from('client_tasks')
      .update({ is_completed: newVal, completed_at: completedAt })
      .eq('id', task.id).eq('user_id', user.id)
  }

  const handleDeleteTask = async (task) => {
    setTasksByPortal((prev) => ({
      ...prev,
      [task.portal_id]: prev[task.portal_id].filter((t) => t.id !== task.id),
    }))
    await supabase.from('client_tasks')
      .delete().eq('id', task.id).eq('user_id', user.id)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  }

  // ─── Empty state ───
  if (portals.length === 0) {
    return (
      <div className="card p-8 md:p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-gold/15 text-gold-dark flex items-center justify-center mx-auto">
          <LockIcon className="w-6 h-6" />
        </div>
        <h2 className="font-display text-2xl font-bold text-navy mt-4">Client Portal</h2>
        <p className="text-muted text-sm mt-2 max-w-md mx-auto leading-relaxed">
          Give your client a private window into their transaction. They'll see the current phase, upcoming steps, and their personal to-do list.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-md mx-auto">
          <button
            onClick={() => handleCreate('buyer')}
            disabled={creating === 'buyer'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5 min-h-[48px] transition-colors disabled:opacity-50"
          >
            {creating === 'buyer' ? <LoadingSpinner size="sm" light /> : 'Create Buyer Portal'}
          </button>
          <button
            onClick={() => handleCreate('seller')}
            disabled={creating === 'seller'}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-5 min-h-[48px] transition-colors disabled:opacity-50"
          >
            {creating === 'seller' ? <LoadingSpinner size="sm" light /> : 'Create Seller Portal'}
          </button>
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-4">{error}</p>
        )}
        <p className="badge-gold mt-6">Pro feature — upgrade to share portals with clients</p>
      </div>
    )
  }

  // ─── Portal management view ───
  const canAddOther = !buyerPortal || !sellerPortal

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {portals.map((portal) => (
        <PortalCard
          key={portal.id}
          portal={portal}
          tasks={tasksByPortal[portal.id] || []}
          onToggleActive={() => handleToggleActive(portal)}
          onAgentPhoneSave={(phone) => handleAgentPhoneSave(portal, phone)}
          onAddTask={(payload) => handleAddTask(portal.id, payload)}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />
      ))}

      {canAddOther && (
        <div className="card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-navy font-semibold text-sm">Create another portal</p>
            <p className="text-muted text-xs mt-0.5">
              {!buyerPortal ? 'Add a portal for the buyer side.' : 'Add a portal for the seller side.'}
            </p>
          </div>
          <button
            onClick={() => handleCreate(buyerPortal ? 'seller' : 'buyer')}
            disabled={creating !== null}
            className="bg-navy hover:bg-navy-light text-white font-semibold rounded-xl px-4 h-10 text-sm transition-colors disabled:opacity-50"
          >
            {creating ? <LoadingSpinner size="sm" light /> : `+ ${buyerPortal ? 'Seller' : 'Buyer'} Portal`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Portal card ───────────────────────────
function PortalCard({ portal, tasks, onToggleActive, onAgentPhoneSave, onAddTask, onToggleTask, onDeleteTask }) {
  const portalUrl = `${window.location.origin}/portal/${portal.token}`
  const [copied, setCopied] = useState(false)
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState(portal.agent_phone || '')

  useEffect(() => { setPhoneDraft(portal.agent_phone || '') }, [portal.agent_phone])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl)
    } catch {
      // Fallback — temporary textarea
      const ta = document.createElement('textarea')
      ta.value = portalUrl
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Your transaction portal',
          text: 'View the details of your real estate transaction.',
          url: portalUrl,
        })
      } catch {}
    } else {
      handleCopy()
    }
  }

  const completedCount = tasks.filter((t) => t.is_completed).length
  const isBuyer = portal.client_type === 'buyer'

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge-pill ${
                portal.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${portal.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                {portal.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className={`badge-pill ${
                isBuyer ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {isBuyer ? 'Buyer' : 'Seller'}
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-navy mt-2 leading-tight">
              {portal.client_name || `${isBuyer ? 'Buyer' : 'Seller'} Portal`}
            </h3>
            <p className="text-muted text-xs mt-1">Created {formatDate(portal.created_at)}</p>
          </div>
          <button
            onClick={onToggleActive}
            className={`text-xs font-semibold rounded-lg px-3 h-8 transition-colors ${
              portal.is_active
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {portal.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>

        {/* Portal URL */}
        <div className="mt-5 bg-cream rounded-xl p-3 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-muted shrink-0" />
          <code className="flex-1 min-w-0 text-xs text-navy/80 truncate font-mono">{portalUrl}</code>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-2 rounded-xl min-h-[44px] text-sm font-semibold transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-gold hover:bg-gold-light text-navy'
            }`}
          >
            {copied ? (<><CheckIcon className="w-4 h-4" strokeWidth={2.5} />Copied!</>) : (<><CopyIcon className="w-4 h-4" />Copy Link</>)}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 bg-navy/[0.04] hover:bg-navy/[0.08] text-navy rounded-xl min-h-[44px] text-sm font-semibold transition-colors"
          >
            <ShareIcon className="w-4 h-4" />
            Share
          </button>
        </div>

        {/* Agent phone (shown to clients) */}
        <div className="mt-5 border-t border-navy/[0.05] pt-4">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Phone shown to client</p>
          {phoneEditing ? (
            <div className="flex gap-2 mt-2">
              <input
                type="tel"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                placeholder="(813) 555-0100"
                className="input-field flex-1"
                autoFocus
              />
              <button
                onClick={() => { onAgentPhoneSave(phoneDraft); setPhoneEditing(false) }}
                className="bg-navy text-white font-semibold rounded-xl px-4 transition-colors hover:bg-navy-light"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <p className="text-navy text-sm">
                {portal.agent_phone || <span className="text-muted italic">Not set — clients will see name + email only</span>}
              </p>
              <button
                onClick={() => setPhoneEditing(true)}
                className="text-xs font-semibold text-gold-dark hover:text-gold transition-colors"
              >
                {portal.agent_phone ? 'Change' : 'Add phone'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="card p-5 md:p-6">
        <div className="flex items-center justify-between mb-1 gap-3">
          <div>
            <h4 className="font-display text-lg font-bold text-navy leading-tight">Client To-Do List</h4>
            <p className="text-muted text-xs mt-0.5">Tasks your client can check off from their portal.</p>
          </div>
          {tasks.length > 0 && (
            <span className="text-xs text-muted whitespace-nowrap">
              {completedCount}/{tasks.length} done
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <p className="text-muted text-sm mt-3">No tasks yet — add some below or use a template.</p>
        ) : (
          <ul className="mt-4 space-y-1 divide-y divide-navy/[0.05]">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => onToggleTask(task)}
                onDelete={() => onDeleteTask(task)}
              />
            ))}
          </ul>
        )}

        <AddTaskForm onAdd={onAddTask} />

        <TemplateButtons
          templates={isBuyer ? BUYER_TASKS : SELLER_TASKS}
          existingTitles={tasks.map((t) => t.title.toLowerCase())}
          onAdd={(title) => onAddTask({ title })}
        />
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const overdue = !task.is_completed && isPastDue(task.due_date)
  return (
    <li className="flex items-start gap-3 py-3 group">
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
          task.is_completed
            ? 'bg-green-500 border-green-500'
            : overdue ? 'border-red-400 bg-white' : 'border-navy/20 bg-white hover:border-gold'
        }`}
        aria-pressed={task.is_completed}
      >
        {task.is_completed && <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${
          task.is_completed
            ? 'line-through text-muted'
            : overdue ? 'text-red-600 font-medium' : 'text-navy'
        }`}>
          {task.title}
        </p>
        {task.description && !task.is_completed && (
          <p className="text-muted text-xs mt-0.5">{task.description}</p>
        )}
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1 ${
            overdue ? 'text-red-500' : 'text-gold-dark'
          }`}>
            <CalendarIcon className="w-3 h-3" />
            Due {formatDate(task.due_date)}
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </li>
  )
}

function AddTaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await onAdd({ title, description, due_date: due || null })
    setTitle(''); setDescription(''); setDue('')
  }

  return (
    <form onSubmit={submit} className="mt-5 pt-5 border-t border-navy/[0.05] space-y-3">
      <div>
        <label className="label">Task title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          placeholder="e.g. Send proof of funds"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-1">
          <label className="label">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field"
            placeholder="Extra context for your client"
          />
        </div>
        <div>
          <label className="label">Due date (optional)</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input-field" />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto sm:px-8">
        <PlusIcon className="w-5 h-5 mr-1.5" strokeWidth={2.5} />
        Add Task
      </button>
    </form>
  )
}

function TemplateButtons({ templates, existingTitles, onAdd }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-5 pt-5 border-t border-navy/[0.05]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-gold-dark hover:text-gold transition-colors flex items-center gap-1"
      >
        {open ? '−' : '+'} Add Common Tasks
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
          {templates.map((t) => {
            const already = existingTitles.includes(t.toLowerCase())
            return (
              <button
                key={t}
                onClick={() => onAdd(t)}
                disabled={already}
                className={`text-xs font-semibold rounded-full px-3 h-9 transition-colors ${
                  already
                    ? 'bg-navy/[0.04] text-muted cursor-not-allowed'
                    : 'bg-gold/15 text-gold-dark hover:bg-gold/25'
                }`}
              >
                {already ? '✓ ' : '+ '}{t}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
