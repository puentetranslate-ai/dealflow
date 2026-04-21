import PhaseBadge from './PhaseBadge'
import { formatCurrency, formatDate, daysUntil, daysInPhase, isPastDue } from '../lib/utils'

export default function DealCard({ deal, nextDeadline, onClick }) {
  const clientName =
    deal.agent_role === 'buyer'
      ? deal.buyer_name || 'Buyer TBD'
      : deal.seller_name || 'Seller TBD'

  const daysInCurrent = daysInPhase(deal.phase_changed_at || deal.created_at)
  const closingDays = deal.closing_date ? daysUntil(deal.closing_date) : null

  return (
    <div
      className="card p-4 active:scale-[0.98] transition-transform cursor-pointer border border-transparent active:border-gold/20"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy text-base leading-tight truncate">{deal.address}</h3>
          <p className="text-muted text-sm mt-0.5">{clientName}</p>
        </div>
        <div className="shrink-0">
          <PhaseBadge phase={deal.phase} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-navy font-bold text-sm">{formatCurrency(deal.sale_price)}</span>
        <span className="text-muted text-xs">{daysInCurrent}d in phase</span>
      </div>

      {nextDeadline ? (
        <div className="bg-cream rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-navy text-xs font-medium truncate flex-1">{nextDeadline.label}</span>
          <span className={`text-xs font-semibold whitespace-nowrap shrink-0 ${isPastDue(nextDeadline.due_date) ? 'text-red-500' : (daysUntil(nextDeadline.due_date) ?? 99) <= 3 ? 'text-orange-500' : 'text-muted'}`}>
            {formatDate(nextDeadline.due_date)}
          </span>
        </div>
      ) : deal.closing_date ? (
        <div className="bg-cream rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-navy text-xs font-medium">Closing</span>
          <span className={`text-xs font-semibold whitespace-nowrap ${closingDays !== null && closingDays < 0 ? 'text-red-500' : closingDays !== null && closingDays <= 7 ? 'text-orange-500' : 'text-muted'}`}>
            {formatDate(deal.closing_date)}
            {closingDays !== null && closingDays >= 0 && (
              <span className="ml-1 text-muted font-normal">({closingDays}d)</span>
            )}
          </span>
        </div>
      ) : null}
    </div>
  )
}
