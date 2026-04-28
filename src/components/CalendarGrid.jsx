import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format,
} from 'date-fns'
import EventPill, { EventDot } from './EventPill'

// Reusable monthly calendar grid. Renders a 6-row × 7-col grid covering the
// month plus padding days from previous/next months so the layout is stable.
//
// On desktop each cell shows up to 3 event pills + "+X more". On mobile
// each cell shows the date number plus colored dots (max 4) for events;
// tapping a cell selects it (parent renders a list of that day's events).

export default function CalendarGrid({
  monthDate,
  eventsByDate,
  selectedDate,
  onSelectDay,
  onSelectEvent,
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate))
    const end = endOfWeek(endOfMonth(monthDate))
    return eachDayOfInterval({ start, end })
  }, [monthDate])

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-navy/[0.06] bg-navy/[0.02]">
        {weekdayLabels.map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted text-center">
            <span className="md:hidden">{d[0]}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const events = eventsByDate[key] || []
          const inMonth = isSameMonth(day, monthDate)
          const isCurrentDay = isToday(day)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          return (
            <DayCell
              key={key}
              day={day}
              events={events}
              inMonth={inMonth}
              isCurrentDay={isCurrentDay}
              isSelected={isSelected}
              onSelectDay={() => onSelectDay(day)}
              onSelectEvent={onSelectEvent}
            />
          )
        })}
      </div>
    </div>
  )
}

function DayCell({ day, events, inMonth, isCurrentDay, isSelected, onSelectDay, onSelectEvent }) {
  const [expanded, setExpanded] = useState(false)
  const visiblePills = expanded ? events : events.slice(0, 3)
  const overflow = events.length - visiblePills.length

  return (
    <div
      className={`min-h-[64px] md:min-h-[110px] border-b border-r border-navy/[0.04] last:border-r-0 p-1.5 md:p-2 cursor-pointer transition-colors ${
        inMonth ? 'bg-white' : 'bg-cream/40'
      } ${isSelected ? 'ring-2 ring-gold/50 ring-inset' : 'hover:bg-cream/60'}`}
      onClick={onSelectDay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelectDay() }}
    >
      {/* Day number */}
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center justify-center text-xs md:text-sm font-semibold rounded-full ${
            isCurrentDay
              ? 'bg-gold text-navy w-6 h-6 md:w-7 md:h-7'
              : inMonth ? 'text-navy' : 'text-muted/50'
          }`}
        >
          {format(day, 'd')}
        </span>

        {/* Mobile dots */}
        <div className="flex md:hidden items-center gap-0.5">
          {events.slice(0, 4).map((e) => (
            <EventDot key={e.id} type={e.type} />
          ))}
          {events.length > 4 && (
            <span className="text-[9px] text-muted ml-0.5">+{events.length - 4}</span>
          )}
        </div>
      </div>

      {/* Desktop pills */}
      <div className="hidden md:block mt-1.5 space-y-1">
        {visiblePills.map((e) => (
          <EventPill
            key={e.id}
            event={e}
            onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e) }}
            compact
          />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(ev) => { ev.stopPropagation(); setExpanded(true) }}
            className="text-[10px] font-semibold text-gold-dark hover:text-gold transition-colors"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Weekly view ───────────────────────────
// Simpler than a Google-Calendar style hourly grid since none of our events
// carry times — just dates. Renders one column per day of the current week
// with events stacked under each day header. Easier to read and ships now;
// can be upgraded to hourly slots once events have times.

export function WeeklyGrid({ weekDate, eventsByDate, onSelectEvent }) {
  const days = useMemo(() => {
    const start = startOfWeek(weekDate)
    const end = endOfWeek(weekDate)
    return eachDayOfInterval({ start, end })
  }, [weekDate])

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-navy/[0.06] bg-navy/[0.02]">
        {days.map((d) => {
          const isCurrentDay = isToday(d)
          return (
            <div key={d.toISOString()} className="px-2 py-3 text-center border-r border-navy/[0.04] last:border-r-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{format(d, 'EEE')}</p>
              <p className={`font-display text-xl font-bold mt-1 leading-none ${
                isCurrentDay ? 'text-gold-dark' : 'text-navy'
              }`}>
                {format(d, 'd')}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-7 min-h-[300px]">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const events = eventsByDate[key] || []
          return (
            <div key={key} className="border-r border-navy/[0.04] last:border-r-0 p-2 space-y-1">
              {events.length === 0 ? (
                <span className="text-[10px] text-muted/50">—</span>
              ) : (
                events.map((e) => (
                  <EventPill
                    key={e.id}
                    event={e}
                    onClick={() => onSelectEvent(e)}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
