import PhaseBadge from './PhaseBadge'
import { formatCurrency, formatDate, daysUntil, daysInPhase, isPastDue, calcCommission } from '../lib/utils'
import { CalendarIcon } from './Icon'

// Deal card used on Dashboard, Client Directory (mobile fall-through), etc.
// Layout matches the spec:
//   - Address (Playfair) + city/state subtitle
//   - Phase badge with "Xd in phase" subtitle
//   - Sale price + gold commission
//   - Closing date + days remaining + buyer/seller name

export default function DealCard({ deal, nextDeadline, onClick }) {
  const clientName =
    deal.agent_role === 'buyer'
      ? deal.buyer_name || 'Buyer TBD'
      : deal.seller_name || 'Seller TBD'

  const clientLabel = deal.agent_role === 'buyer' ? 'Buyer' : 'Seller'
  const daysInCurrent = daysInPhase(deal.phase_changed_at || deal.created_at)
  const closingDays = deal.closing_date ? daysUntil(deal.closing_date) : null
  const commission = calcCommission(deal.sale_price, deal.commission_pct)
  const { line1, line2 } = splitAddress(deal.address)

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-hover w-full text-left p-5 group"
    >
      {/* Address + phase */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold text-navy leading-tight truncate">
            {line1}
          </h3>
          {line2 && (
            <p className="text-muted text-xs mt-0.5 truncate">{line2}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <PhaseBadge phase={deal.phase} />
          <span className="text-[10px] font-medium text-muted">
            {daysInCurrent}d in phase
          </span>
        </div>
      </div>

      {/* Sale price + commission */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-navy/[0.05]">
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Sale Price</p>
          <p className="text-navy font-bold text-base mt-0.5">{formatCurrency(deal.sale_price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Commission</p>
          <p className="text-gold-dark font-bold text-base mt-0.5">{formatCurrency(commission)}</p>
        </div>
      </div>

      {/* Closing + buyer/seller */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-navy/[0.05]">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarIcon className="w-3.5 h-3.5 text-muted shrink-0" />
          {deal.closing_date ? (
            <span className={`text-xs font-medium ${
              closingDays !== null && closingDays < 0
                ? 'text-red-500'
                : closingDays !== null && closingDays <= 7
                ? 'text-orange-500'
                : 'text-navy/70'
            }`}>
              {formatDate(deal.closing_date)}
              {closingDays !== null && closingDays >= 0 && (
                <span className="text-muted ml-1">· {closingDays}d</span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted">No close date</span>
          )}
        </div>
        <div className="text-right min-w-0 truncate">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider mr-1.5">{clientLabel}</span>
          <span className="text-xs font-semibold text-navy">{clientName}</span>
        </div>
      </div>

      {/* Optional next-deadline banner (when there's a near-term checklist item) */}
      {nextDeadline && (
        <div className="mt-3 bg-gold/10 border border-gold/20 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-navy text-xs font-medium truncate">{nextDeadline.label}</span>
          <span className={`text-xs font-bold whitespace-nowrap shrink-0 ${
            isPastDue(nextDeadline.due_date)
              ? 'text-red-500'
              : (daysUntil(nextDeadline.due_date) ?? 99) <= 3
              ? 'text-orange-500'
              : 'text-gold-dark'
          }`}>
            {formatDate(nextDeadline.due_date)}
          </span>
        </div>
      )}
    </button>
  )
}

// Split "123 Main St, Tampa, FL" into ["123 Main St", "Tampa, FL"] for two-line display.
function splitAddress(address) {
  if (!address) return { line1: '', line2: '' }
  const idx = address.indexOf(',')
  if (idx === -1) return { line1: address, line2: '' }
  return { line1: address.slice(0, idx).trim(), line2: address.slice(idx + 1).trim() }
}
