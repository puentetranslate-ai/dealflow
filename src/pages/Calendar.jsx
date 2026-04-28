import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, parseISO,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isPastDue } from '../lib/utils'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import CalendarGrid, { WeeklyGrid } from '../components/CalendarGrid'
import EventPill, { EVENT_STYLES } from '../components/EventPill'
import EventDetailSheet from '../components/EventDetailSheet'
import {
  ArrowLeftIcon, ArrowRightIcon, PlusIcon, CalendarIcon,
} from '../components/Icon'

// Pulls events from 5 sources and renders a unified calendar:
//   - deals.closing_date     → green
//   - deals.offer_date       → blue
//   - checklist_items.due    → orange (red if overdue)
//   - leads.follow_up_date   → purple
//   - client_tasks.due_date  → amber

export default function Calendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [today] = useState(() => new Date())
  const [cursor, setCursor] = useState(today)        // anchor date (month or week)
  const [view, setView] = useState('monthly')        // monthly | weekly
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeEvent, setActiveEvent] = useState(null)

  // Single fetch on mount — all events for this user. Date-bucketing happens
  // client-side, so navigation between months/weeks is free.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('deals')
        .select('id, address, closing_date, offer_date')
        .eq('user_id', user.id),
      supabase
        .from('checklist_items')
        .select('id, deal_id, label, due_date, is_checked')
        .eq('user_id', user.id)
        .eq('is_checked', false)
        .not('due_date', 'is', null),
      supabase
        .from('leads')
        .select('id, first_name, last_name, follow_up_date')
        .eq('user_id', user.id)
        .not('follow_up_date', 'is', null),
      supabase
        .from('client_tasks')
        .select('id, deal_id, title, due_date, is_completed')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .not('due_date', 'is', null),
    ]).then(([dealsRes, checklistRes, leadsRes, tasksRes]) => {
      if (cancelled) return
      const out = []

      ;(dealsRes.data || []).forEach((d) => {
        if (d.closing_date) {
          out.push({
            id: `deal-${d.id}-closing`,
            type: 'closing',
            title: `Closing: ${shortAddress(d.address)}`,
            subtitle: d.address,
            date: d.closing_date,
            link: `/deals/${d.id}`,
          })
        }
        if (d.offer_date) {
          out.push({
            id: `deal-${d.id}-offer`,
            type: 'offer',
            title: `Offer: ${shortAddress(d.address)}`,
            subtitle: d.address,
            date: d.offer_date,
            link: `/deals/${d.id}`,
          })
        }
      })

      ;(checklistRes.data || []).forEach((c) => {
        out.push({
          id: `check-${c.id}`,
          type: isPastDue(c.due_date) ? 'overdue' : 'checklist',
          title: c.label,
          subtitle: 'Checklist item',
          date: c.due_date,
          link: c.deal_id ? `/deals/${c.deal_id}` : null,
        })
      })

      ;(leadsRes.data || []).forEach((l) => {
        const name = `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Lead'
        out.push({
          id: `lead-${l.id}`,
          type: 'lead-followup',
          title: `Follow up: ${name}`,
          subtitle: 'Lead follow-up',
          date: l.follow_up_date,
          link: `/leads/${l.id}/edit`,
        })
      })

      ;(tasksRes.data || []).forEach((t) => {
        out.push({
          id: `task-${t.id}`,
          type: 'client-task',
          title: `Client task: ${t.title}`,
          subtitle: 'Assigned to client',
          date: t.due_date,
          link: t.deal_id ? `/deals/${t.deal_id}` : null,
        })
      })

      setEvents(out)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.id])

  // Bucket events by yyyy-MM-dd for O(1) lookup in the grid
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    // Sort within each day: overdue first, then by type
    const order = ['overdue', 'closing', 'offer', 'lead-followup', 'checklist', 'client-task']
    Object.values(map).forEach((arr) => arr.sort((a, b) =>
      order.indexOf(a.type) - order.indexOf(b.type)
    ))
    return map
  }, [events])

  // Selected day events (mobile day-detail list)
  const selectedKey = format(selectedDate, 'yyyy-MM-dd')
  const selectedDayEvents = eventsByDate[selectedKey] || []

  // Events in the visible month — for the empty state and "no events" hints
  const monthEvents = useMemo(() => {
    if (view === 'weekly') return events
    return events.filter((e) => {
      try { return isSameMonth(parseISO(e.date), cursor) } catch { return false }
    })
  }, [events, cursor, view])

  // Navigation helpers
  const goPrev = () => setCursor(view === 'monthly' ? subMonths(cursor, 1) : subWeeks(cursor, 1))
  const goNext = () => setCursor(view === 'monthly' ? addMonths(cursor, 1) : addWeeks(cursor, 1))
  const goToday = () => { setCursor(today); setSelectedDate(today) }

  return (
    <AppLayout>
      <MobileHeader eyebrow="SCHEDULE" title="Calendar" showBell />
      <TopBar />

      <div className="hidden md:block px-8 pt-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Schedule</p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">Calendar</h1>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12">
        {/* Header bar: title + nav + view toggle + add */}
        <div className="card p-4 md:p-5 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                aria-label="Previous"
                className="w-9 h-9 rounded-lg bg-navy/[0.04] hover:bg-navy/[0.08] text-navy flex items-center justify-center transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </button>
              <h2 className="font-display text-xl md:text-2xl font-bold text-navy mx-1 min-w-[140px] text-center">
                {format(cursor, view === 'monthly' ? 'MMMM yyyy' : "MMM d, yyyy")}
              </h2>
              <button
                onClick={goNext}
                aria-label="Next"
                className="w-9 h-9 rounded-lg bg-navy/[0.04] hover:bg-navy/[0.08] text-navy flex items-center justify-center transition-colors"
              >
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="ml-1 px-3 h-9 rounded-lg bg-gold/15 hover:bg-gold/25 text-gold-dark text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-navy/10 rounded-full p-1">
                <ToggleTab active={view === 'monthly'} onClick={() => setView('monthly')}>Month</ToggleTab>
                <ToggleTab active={view === 'weekly'} onClick={() => setView('weekly')}>Week</ToggleTab>
              </div>
              <button
                onClick={() => navigate('/deals/new')}
                className="hidden md:flex items-center gap-1.5 bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl px-4 h-10 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Color legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
            <Legend type="closing" />
            <Legend type="offer" />
            <Legend type="checklist" />
            <Legend type="overdue" />
            <Legend type="lead-followup" />
            <Legend type="client-task" />
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner /></div>
        ) : (
          <>
            {view === 'monthly' ? (
              <CalendarGrid
                monthDate={cursor}
                eventsByDate={eventsByDate}
                selectedDate={selectedDate}
                onSelectDay={setSelectedDate}
                onSelectEvent={setActiveEvent}
              />
            ) : (
              <WeeklyGrid
                weekDate={cursor}
                eventsByDate={eventsByDate}
                onSelectEvent={setActiveEvent}
              />
            )}

            {/* Mobile day-detail list */}
            {view === 'monthly' && (
              <div className="md:hidden mt-4">
                <h3 className="font-display text-lg font-bold text-navy">
                  {format(selectedDate, 'EEEE, MMM d')}
                </h3>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-muted text-sm mt-2">No events on this day.</p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {selectedDayEvents.map((e) => (
                      <EventPill
                        key={e.id}
                        event={e}
                        onClick={() => setActiveEvent(e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state for the visible month */}
            {monthEvents.length === 0 && (
              <div className="mt-6 text-center py-8 px-4">
                <CalendarIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
                <p className="text-navy font-semibold">
                  Nothing scheduled this {view === 'monthly' ? 'month' : 'week'}.
                </p>
                <p className="text-muted text-sm mt-1">
                  Add closing dates and deadlines to your deals to see them here.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <EventDetailSheet event={activeEvent} onClose={() => setActiveEvent(null)} />
    </AppLayout>
  )
}

function ToggleTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-8 rounded-full text-xs font-semibold transition-colors ${
        active ? 'bg-navy text-white' : 'text-navy/70 hover:text-navy'
      }`}
    >
      {children}
    </button>
  )
}

function Legend({ type }) {
  const s = EVENT_STYLES[type]
  if (!s) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// "1247 Bayshore Blvd, Tampa, FL" → "1247 Bayshore Blvd"
function shortAddress(addr) {
  if (!addr) return '—'
  const i = addr.indexOf(',')
  return i === -1 ? addr : addr.slice(0, i)
}
