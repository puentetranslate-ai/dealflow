import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isPast } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CalendarIcon, CheckIcon, ArrowRightIcon, HouseIcon } from './Icon'
import LoadingSpinner from './LoadingSpinner'

// Compact showing display used in lists. Past-date scheduled showings
// open an inline post-showing notes panel and a Mark Complete button.
//
// On Mark Complete: status='completed' AND if a deal_id is linked we
// auto-log a Note entry to comm_logs so the conversation history is
// captured.

export default function ShowingCard({ showing, onUpdate, compact = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState(showing.post_showing_notes || '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const showingDate = parseISO(showing.showing_date)
  const isPastDate = isPast(showingDate) && showing.status === 'scheduled'
  const dateLabel = format(showingDate, 'EEE, MMM d, yyyy')
  const timeLabel = showing.showing_time
    ? format(parseISO(`${showing.showing_date}T${showing.showing_time}`), 'h:mm a')
    : null

  const handleComplete = async () => {
    setSaving(true)
    const { data, error } = await supabase
      .from('showings')
      .update({
        status: 'completed',
        post_showing_notes: notes || null,
      })
      .eq('id', showing.id)
      .eq('user_id', user.id)
      .select().single()

    if (!error) {
      // Auto-log a Note entry to the linked deal so the agent has the
      // post-showing reflection in their comm history.
      if (showing.deal_id) {
        const summary = notes
          ? `Showing on ${dateLabel}: ${notes}`
          : `Showing on ${dateLabel} completed.`
        await supabase.from('comm_logs').insert({
          deal_id: showing.deal_id,
          user_id: user.id,
          log_type: 'Note',
          contact_name: showing.client_name || null,
          summary,
          logged_at: new Date().toISOString(),
        })
      }
      onUpdate?.(data)
      setExpanded(false)
    }
    setSaving(false)
  }

  return (
    <div className={`card p-4 border-l-4 ${
      showing.status === 'completed' ? 'border-l-green-500' : 'border-l-cyan-500'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          showing.status === 'completed'
            ? 'bg-green-100 text-green-700'
            : 'bg-cyan-100 text-cyan-700'
        }`}>
          <HouseIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-700">
              {showing.status === 'completed' ? 'Completed' : 'Showing'}
            </span>
            {timeLabel && (
              <span className="text-xs text-muted">· {timeLabel}</span>
            )}
          </div>
          <h3 className="font-display text-base font-bold text-navy leading-tight truncate">
            {showing.property_address}
          </h3>
          <p className="text-muted text-xs mt-0.5">
            <CalendarIcon className="w-3 h-3 inline-block -translate-y-px mr-1" />
            {dateLabel}
            {showing.client_name && <span> · {showing.client_name}</span>}
          </p>
          {showing.notes && !compact && (
            <p className="text-navy/70 text-xs mt-2 leading-relaxed">{showing.notes}</p>
          )}
        </div>
        {showing.deal_id && (
          <button
            onClick={() => navigate(`/deals/${showing.deal_id}`)}
            aria-label="Open deal"
            className="text-muted hover:text-gold-dark p-2 -m-2 transition-colors"
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Post-showing prompt — only for past-dated scheduled showings */}
      {isPastDate && (
        <div className="mt-4 pt-4 border-t border-navy/[0.05]">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-sm font-semibold text-gold-dark hover:text-gold transition-colors"
            >
              How did the showing go?
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did the client think? Next steps?"
                className="input-field resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(false)}
                  className="btn-outline flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="btn-primary flex-1 text-sm"
                >
                  {saving ? <LoadingSpinner size="sm" /> : (
                    <>
                      <CheckIcon className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                      Mark Complete
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
