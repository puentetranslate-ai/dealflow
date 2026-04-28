import { TEMP_STYLES } from '../lib/leadConstants'
import { formatCurrency, formatDate, daysUntil, isPastDue } from '../lib/utils'
import {
  PhoneIcon, MailIcon, ArrowRightIcon, CalendarIcon, FlameIcon,
} from './Icon'

// Mobile lead card. Used on the Leads page list view.
//
// Shows: temperature accent bar, name, badges, source, budget, target area,
// follow-up date (red if overdue), tap-to-contact buttons, and either
// "Convert to Deal" or "Active Deal →" depending on conversion status.

export default function LeadCard({ lead, onConvert, onView, onOpenDeal }) {
  const temp = TEMP_STYLES[lead.temperature] || TEMP_STYLES.Warm
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
  const isConverted = Boolean(lead.converted_to_deal_id)
  const followDays = lead.follow_up_date ? daysUntil(lead.follow_up_date) : null
  const overdue = lead.follow_up_date && isPastDue(lead.follow_up_date)
  const budget = formatBudget(lead.budget_min, lead.budget_max)

  return (
    <div className={`card p-5 border-l-4 ${temp.accent}`}>
      {/* Header: name + temp + interest */}
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={onView}
          className="text-left min-w-0 flex-1"
        >
          <h3 className="font-display text-lg font-bold text-navy leading-tight truncate">
            {fullName || 'Unnamed lead'}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`badge-pill ${temp.bg} ${temp.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${temp.dot}`} />
              {temp.label}
            </span>
            <span className={`badge-pill ${
              lead.interest_type === 'Buying'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {lead.interest_type}
            </span>
            {isConverted && (
              <span className="badge-pill bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Converted
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Source + budget + area */}
      <dl className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-navy/[0.05]">
        <DataLine label="Source" value={lead.source || '—'} />
        <DataLine label="Budget" value={budget || '—'} />
        {lead.target_area && (
          <DataLine label="Target Area" value={lead.target_area} fullWidth />
        )}
      </dl>

      {/* Follow-up */}
      {lead.follow_up_date && (
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl ${
          overdue ? 'bg-red-50 text-red-600' : 'bg-gold/10 text-gold-dark'
        }`}>
          <CalendarIcon className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">
            Follow up {formatDate(lead.follow_up_date)}
            {followDays !== null && (
              <span className="opacity-70 font-normal ml-1">
                {overdue ? `(${Math.abs(followDays)}d overdue)` : `(${followDays}d)`}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Contact + action row */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <ContactBtn href={lead.phone ? `tel:${lead.phone}` : null} icon={<PhoneIcon className="w-5 h-5" />} label="Call" />
        <ContactBtn href={lead.phone ? `sms:${lead.phone}` : null} icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>} label="Text" />
        <ContactBtn href={lead.email ? `mailto:${lead.email}` : null} icon={<MailIcon className="w-5 h-5" />} label="Email" />
      </div>

      {/* Convert / View deal */}
      <div className="mt-4">
        {isConverted ? (
          <button
            onClick={onOpenDeal}
            className="w-full flex items-center justify-between bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl px-4 min-h-[48px] transition-colors"
          >
            <span className="text-sm">Active Deal</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onConvert}
            className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-4 min-h-[48px] transition-colors"
          >
            <FlameIcon className="w-4 h-4" />
            Convert to Deal
          </button>
        )}
      </div>
    </div>
  )
}

function DataLine({ label, value, fullWidth }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <dt className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</dt>
      <dd className="text-navy text-sm font-medium mt-0.5 truncate">{value}</dd>
    </div>
  )
}

function ContactBtn({ href, icon, label }) {
  const disabled = !href
  const cls = `w-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors py-2 ${
    disabled
      ? 'bg-navy/[0.04] text-muted cursor-not-allowed'
      : 'bg-navy/[0.04] text-navy hover:bg-gold hover:text-navy active:bg-gold-light'
  }`
  const content = <>{icon}<span className="leading-none">{label}</span></>
  if (disabled) return <span className={cls} aria-disabled="true">{content}</span>
  return <a href={href} className={cls}>{content}</a>
}

function formatBudget(min, max) {
  if (!min && !max) return null
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}`
  if (min) return `${formatCurrency(min)}+`
  return `Up to ${formatCurrency(max)}`
}
