import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/utils'
import DealCard from '../components/DealCard'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import BottomNav from '../components/BottomNav'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [deadlineItems, setDeadlineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: dealsData, error: dealsErr } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', user.id)
        .neq('phase', 'Closed')
        .order('created_at', { ascending: false })

      if (dealsErr) throw dealsErr
      setDeals(dealsData || [])

      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, deal_id, label, due_date')
        .eq('user_id', user.id)
        .eq('is_checked', false)
        .not('due_date', 'is', null)
        .gte('due_date', today)
        .lte('due_date', nextWeek)
        .order('due_date', { ascending: true })

      setDeadlineItems(items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { fetchData() }, [fetchData])

  const pendingCommission = deals.reduce(
    (sum, d) => sum + ((d.sale_price || 0) * (d.commission_pct || 0)) / 100,
    0
  )

  const nextDeadlineForDeal = (dealId) =>
    deadlineItems.find((i) => i.deal_id === dealId) || null

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <div className="bg-navy px-5 pt-14 pb-8">
        <p className="text-muted text-sm font-medium">Good morning</p>
        <h1 className="font-display text-3xl font-bold text-white mt-1">
          Deal<span className="text-gold">Flow</span>
        </h1>
      </div>

      <div className="px-4 -mt-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Active Deals" value={deals.length} />
          <StatCard label="Pending Commission" value={formatCurrency(pendingCommission)} small />
          <StatCard
            label="Deadlines This Week"
            value={deadlineItems.length}
            warning={deadlineItems.length > 0}
          />
        </div>
      </div>

      <div className="px-4 mt-7">
        <h2 className="text-navy font-semibold text-lg mb-4">Active Transactions</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {deals.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-navy/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-navy/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <p className="text-navy font-semibold text-base">No active deals</p>
            <p className="text-muted text-sm mt-1">Tap the + button to add your first transaction</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                nextDeadline={nextDeadlineForDeal(deal.id)}
                onClick={() => navigate(`/deals/${deal.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/deals/new')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gold rounded-full shadow-lg flex items-center justify-center z-50 active:scale-95 transition-transform"
        aria-label="New Deal"
      >
        <svg className="w-7 h-7 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <BottomNav />
    </div>
  )
}
