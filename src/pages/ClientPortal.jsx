import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PHASES, PHASE_STYLES } from '../lib/constants'
import { formatDate, daysUntil, isPastDue } from '../lib/utils'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  PhoneIcon, MailIcon, CheckIcon, CalendarIcon, LockIcon,
} from '../components/Icon'

// Public-facing client portal. NO auth required — RLS gates access by
// requiring the parent portal row to have is_active = true.

export default function ClientPortal() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1. Look up the portal by token (RLS allows reading active portals).
      const { data: portal, error: pErr } = await supabase
        .from('client_portals')
        .select('*')
        .eq('token', token)
        .maybeSingle()

      if (cancelled) return

      if (pErr) {
        setState({ status: 'error', message: pErr.message })
        return
      }
      if (!portal) {
        setState({ status: 'invalid' })
        return
      }
      if (!portal.is_active) {
        setState({ status: 'inactive' })
        return
      }

      // 2. Fetch deal + tasks + checklist in parallel
      const [dealRes, tasksRes, checklistRes] = await Promise.all([
        supabase.from('deals').select('*').eq('id', portal.deal_id).maybeSingle(),
        supabase.from('client_tasks').select('*').eq('portal_id', portal.id).order('created_at', { ascending: true }),
        supabase
          .from('checklist_items')
          .select('label, phase, is_checked')
          .eq('deal_id', portal.deal_id)
          .order('created_at', { ascending: true }),
      ])

      if (cancelled) return
      if (!dealRes.data) {
        setState({ status: 'invalid' })
        return
      }

      setState({
        status: 'ok',
        portal,
        deal: dealRes.data,
        tasks: tasksRes.data || [],
        checklist: checklistRes.data || [],
      })
    }

    load()
    return () => { cancelled = true }
  }, [token])

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  if (state.status === 'invalid') return <PortalError title="Link not found" body="This portal link is invalid or has expired. Please contact your agent." />
  if (state.status === 'inactive') return <PortalError title="Portal deactivated" body="This portal has been deactivated. Please contact your agent." />
  if (state.status === 'error') return <PortalError title="Something went wrong" body={state.message} />

  return <PortalView {...state} setTasks={(updater) => setState((s) => ({ ...s, tasks: typeof updater === 'function' ? updater(s.tasks) : updater }))} />
}

// ─────────────────────────── Main view ───────────────────────────
function PortalView({ portal, deal, tasks, checklist, setTasks }) {
  const phaseStyle = PHASE_STYLES[deal.phase] || PHASE_STYLES['Offer Accepted']
  const closingDays = deal.closing_date ? daysUntil(deal.closing_date) : null

  const handleToggleTask = async (task) => {
    const newVal = !task.is_completed
    const completedAt = newVal ? new Date().toISOString() : null
    setTasks((prev) =>
      prev.map((t) => t.id === task.id ? { ...t, is_completed: newVal, completed_at: completedAt } : t)
    )
    const { error } = await supabase
      .from('client_tasks')
      .update({ is_completed: newVal, completed_at: completedAt })
      .eq('id', task.id)
    if (error) {
      // Roll back optimistic update
      setTasks((prev) =>
        prev.map((t) => t.id === task.id ? { ...t, is_completed: !newVal, completed_at: !newVal ? task.completed_at : null } : t)
      )
    }
  }

  // Items for "What's coming next" — uncompleted items in current/upcoming phases.
  const upcomingItems = useMemo(() => {
    const phaseIdx = PHASES.indexOf(deal.phase)
    if (phaseIdx === -1) return []
    return checklist
      .filter((c) => !c.is_checked && PHASES.indexOf(c.phase) >= phaseIdx)
      .slice(0, 3)
  }, [checklist, deal.phase])

  return (
    <div className="min-h-screen bg-cream font-sans text-navy">
      {/* Header */}
      <header className="bg-navy text-white text-center py-7 md:py-10 gold-grid-bg">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Deal<span className="text-gold">Flow</span>
        </h1>
        <p className="text-gold/80 text-xs font-semibold uppercase tracking-[0.18em] mt-1">
          Your Transaction Portal
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-5 md:px-6 py-6 md:py-8 space-y-5 pb-12">
        {/* Property + agent contact */}
        <section className="card p-5 md:p-7">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Your Transaction</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-navy mt-1 leading-tight text-balance">
            {deal.address}
          </h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`badge-pill ${phaseStyle.bg} ${phaseStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${phaseStyle.dot}`} />
              {deal.phase}
            </span>
            {closingDays !== null && deal.phase !== 'Closed' && (
              <span className="text-xs text-muted">
                {closingDays >= 0
                  ? <>Closing in <span className="font-semibold text-navy">{closingDays}d</span></>
                  : <span className="text-red-500 font-semibold">Closing date passed</span>}
              </span>
            )}
          </div>

          {/* Phase progress */}
          <PhaseProgress currentPhase={deal.phase} />

          {/* Agent block */}
          <div className="mt-6 pt-5 border-t border-navy/[0.06]">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Your Agent</p>
            <p className="font-display text-lg font-bold text-navy mt-0.5">
              {portal.agent_name || 'Your DealFlow Agent'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {portal.agent_phone && (
                <a
                  href={`tel:${portal.agent_phone}`}
                  className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl min-h-[48px] px-4 transition-colors"
                >
                  <PhoneIcon className="w-4 h-4" />
                  Call
                </a>
              )}
              {portal.agent_email && (
                <a
                  href={`mailto:${portal.agent_email}`}
                  className="flex items-center justify-center gap-2 bg-navy/[0.04] hover:bg-navy/[0.08] text-navy font-semibold rounded-xl min-h-[48px] px-4 transition-colors"
                >
                  <MailIcon className="w-4 h-4" />
                  Email
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="card p-5 md:p-7">
          <h3 className="section-title">Transaction Timeline</h3>
          <Timeline currentPhase={deal.phase} closingDate={deal.closing_date} />
        </section>

        {/* Client tasks */}
        <section className="card p-5 md:p-7">
          <h3 className="font-display text-xl font-bold text-navy">Your To-Do List</h3>
          <p className="text-muted text-xs mt-0.5">Tap each task as you complete it.</p>
          {tasks.length === 0 ? (
            <p className="mt-5 text-sm text-muted text-center py-6">
              Your agent hasn't assigned any tasks yet. Check back soon.
            </p>
          ) : (
            <ul className="mt-4 space-y-1 divide-y divide-navy/[0.05]">
              {tasks.map((task) => (
                <ClientTaskRow key={task.id} task={task} onToggle={() => handleToggleTask(task)} />
              ))}
            </ul>
          )}
        </section>

        {/* What's coming next */}
        {upcomingItems.length > 0 && (
          <section className="card p-5 md:p-7">
            <h3 className="font-display text-xl font-bold text-navy">What's coming next</h3>
            <p className="text-muted text-xs mt-0.5">Steps your agent is working on.</p>
            <ul className="mt-4 space-y-2.5">
              {upcomingItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />
                  <span className="text-navy/90 leading-relaxed">{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-navy text-white/50 text-center text-xs py-5">
        Powered by <a href="https://dealflownow.net" className="text-gold-light hover:text-gold">DealFlow</a> · dealflownow.net
      </footer>
    </div>
  )
}

// ─────────────────────────── Sub-components ───────────────────────────
function PhaseProgress({ currentPhase }) {
  const phases = PHASES.filter((p) => p !== 'Closed')
  const currentIdx = phases.indexOf(currentPhase)
  return (
    <div className="mt-5">
      <div className="flex h-2 rounded-full overflow-hidden bg-navy/[0.06] gap-0.5">
        {phases.map((p, i) => {
          const style = PHASE_STYLES[p]
          const isPast = i < currentIdx
          const isCurrent = i === currentIdx
          return (
            <div
              key={p}
              className={`flex-1 ${isPast || isCurrent ? style.dot : ''} ${isCurrent ? 'animate-pulse' : ''}`}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {phases.map((p, i) => (
          <span
            key={p}
            className={`text-[10px] font-semibold text-center truncate ${
              i === currentIdx ? 'text-navy' : 'text-muted'
            }`}
          >
            {SHORT[p]}
          </span>
        ))}
      </div>
    </div>
  )
}

const SHORT = {
  'Offer Accepted': 'Offer',
  'Inspection': 'Insp.',
  'Appraisal': 'Appr.',
  'Title': 'Title',
  'Clear to Close': 'CTC',
}

function Timeline({ currentPhase, closingDate }) {
  const phases = PHASES.filter((p) => p !== 'Closed')
  const currentIdx = phases.indexOf(currentPhase)

  return (
    <ol className="relative space-y-5 mt-3">
      {phases.map((p, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <li key={p} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isPast
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                    ? 'bg-gold border-gold animate-pulse'
                    : 'bg-white border-navy/20'
                }`}
              >
                {isPast && <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              {i < phases.length - 1 && (
                <span className={`w-0.5 h-7 ${isPast ? 'bg-green-300' : 'bg-navy/10'}`} />
              )}
            </div>
            <div className="-mt-0.5">
              <p className={`text-sm font-semibold leading-tight ${
                isCurrent ? 'text-navy' : isPast ? 'text-navy/60' : 'text-navy/40'
              }`}>
                {p}
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-gold-dark">Current</span>
                )}
                {isPast && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-green-600">Done</span>
                )}
              </p>
            </div>
          </li>
        )
      })}
      {closingDate && (
        <li className="flex items-start gap-3 pt-1">
          <div className="flex flex-col items-center shrink-0">
            <span className="w-4 h-4 rounded-full border-2 border-navy/20 bg-cream" />
          </div>
          <div className="-mt-0.5">
            <p className="text-sm font-semibold text-navy/60 leading-tight">Closing</p>
            <p className="text-xs text-muted mt-0.5">
              Expected {formatDate(closingDate)}
              {(() => {
                const d = daysUntil(closingDate)
                if (d == null) return null
                return d >= 0 ? ` · ${d}d to go` : ` · ${Math.abs(d)}d ago`
              })()}
            </p>
          </div>
        </li>
      )}
    </ol>
  )
}

function ClientTaskRow({ task, onToggle }) {
  const overdue = !task.is_completed && isPastDue(task.due_date)
  return (
    <li className="flex items-start gap-3 py-3">
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
          task.is_completed
            ? 'bg-green-500 border-green-500'
            : overdue ? 'border-red-400 bg-white' : 'border-navy/20 bg-white hover:border-gold'
        }`}
        aria-pressed={task.is_completed}
      >
        {task.is_completed && <CheckIcon className="w-4 h-4 text-white" strokeWidth={3} />}
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
          <p className="text-muted text-xs mt-0.5 leading-relaxed">{task.description}</p>
        )}
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1 ${
            overdue ? 'text-red-500' : task.is_completed ? 'text-muted' : 'text-gold-dark'
          }`}>
            <CalendarIcon className="w-3 h-3" />
            Due {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </li>
  )
}

// ─────────────────────────── Error states ───────────────────────────
function PortalError({ title, body }) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-navy text-gold flex items-center justify-center mx-auto">
          <LockIcon className="w-7 h-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-navy mt-5">{title}</h1>
        <p className="text-muted text-sm mt-3 leading-relaxed">{body}</p>
        <p className="text-muted text-xs mt-8">
          <a href="https://dealflownow.net" className="text-gold-dark hover:text-gold font-semibold">DealFlow</a> · dealflownow.net
        </p>
      </div>
    </div>
  )
}
