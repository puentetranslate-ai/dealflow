import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate } from '../lib/utils'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import BottomNav from '../components/BottomNav'

export default function CommissionTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('deals')
      .select('id, address, sale_price, commission_pct, phase, closing_date')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || [])
        setLoading(false)
      })
  }, [user.id])

  const openDeals = deals.filter((d) => d.phase !== 'Closed')
  const closedDeals = deals.filter((d) => d.phase === 'Closed')

  const commission = (deal) => ((deal.sale_price || 0) * (deal.commission_pct || 0)) / 100

  const pendingTotal = openDeals.reduce((s, d) => s + commission(d), 0)
  const earnedTotal = closedDeals.reduce((s, d) => s + commission(d), 0)

  return (
    <div className="min-h-screen bg-cream pb-28">
      <div className="bg-navy px-4 pt-14 pb-6 sticky top-0 z-40">
        <h1 className="font-display text-2xl font-bold text-white">Commission</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-muted font-medium mb-1">Pending</p>
              <p className="font-display text-2xl font-bold text-navy">{formatCurrency(pendingTotal)}</p>
              <p className="text-xs text-muted mt-1">{openDeals.length} open deal{openDeals.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted font-medium mb-1">Earned</p>
              <p className="font-display text-2xl font-bold text-green-600">{formatCurrency(earnedTotal)}</p>
              <p className="text-xs text-muted mt-1">{closedDeals.length} closed deal{closedDeals.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Open Deals */}
          {openDeals.length > 0 && (
            <div>
              <p className="section-title">Open Transactions</p>
              <div className="space-y-2">
                {openDeals.map((deal) => (
                  <CommissionRow
                    key={deal.id}
                    deal={deal}
                    commission={commission(deal)}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Closed Deals */}
          {closedDeals.length > 0 && (
            <div>
              <p className="section-title">Closed Transactions</p>
              <div className="space-y-2">
                {closedDeals.map((deal) => (
                  <CommissionRow
                    key={deal.id}
                    deal={deal}
                    commission={commission(deal)}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    closed
                  />
                ))}
              </div>
            </div>
          )}

          {deals.length === 0 && (
            <div className="text-center py-16">
              <p className="text-navy font-semibold">No deals yet</p>
              <p className="text-muted text-sm mt-1">Commission data will appear here</p>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function CommissionRow({ deal, commission, onClick, closed = false }) {
  return (
    <div
      className={`card p-4 active:scale-[0.98] transition-transform cursor-pointer border-l-4 ${
        closed ? 'border-l-green-500' : 'border-l-navy'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-navy text-sm leading-tight flex-1 truncate">{deal.address}</p>
        <PhaseBadge phase={deal.phase} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{formatCurrency(deal.sale_price)} @ {deal.commission_pct}%</p>
          {deal.closing_date && (
            <p className="text-xs text-muted mt-0.5">Closes {formatDate(deal.closing_date)}</p>
          )}
        </div>
        <p className={`font-bold text-lg ${closed ? 'text-green-600' : 'text-navy'}`}>
          {formatCurrency(commission)}
        </p>
      </div>
    </div>
  )
}
