import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PhaseBadge from '../components/PhaseBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import BottomNav from '../components/BottomNav'

export default function ClientDirectory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('deals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || [])
        setLoading(false)
      })
  }, [user.id])

  const clients = useMemo(() => {
    const list = []
    deals.forEach((deal) => {
      if (deal.buyer_name) {
        list.push({
          key: `${deal.id}-buyer`,
          name: deal.buyer_name,
          phone: deal.buyer_phone,
          email: deal.buyer_email,
          role: 'Buyer',
          address: deal.address,
          phase: deal.phase,
          dealId: deal.id,
        })
      }
      if (deal.seller_name) {
        list.push({
          key: `${deal.id}-seller`,
          name: deal.seller_name,
          phone: deal.seller_phone,
          email: deal.seller_email,
          role: 'Seller',
          address: deal.address,
          phase: deal.phase,
          dealId: deal.id,
        })
      }
    })
    return list
  }, [deals])

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.toLowerCase()
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.address?.toLowerCase().includes(q)
    )
  }, [clients, search])

  return (
    <div className="min-h-screen bg-cream pb-28">
      <div className="bg-navy px-4 pt-14 pb-5 sticky top-0 z-40">
        <h1 className="font-display text-2xl font-bold text-white mb-4">Clients</h1>
        <div className="relative">
          <svg
            className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full bg-white/10 text-white placeholder-white/40 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:bg-white/20"
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-navy/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-navy/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-navy font-semibold">
              {search ? 'No results found' : 'No clients yet'}
            </p>
            <p className="text-muted text-sm mt-1">
              {search ? 'Try a different search' : 'Clients appear automatically from your deals'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((client) => (
              <div
                key={client.key}
                className="card p-4 active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => navigate(`/deals/${client.dealId}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-navy text-base">{client.name}</p>
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${
                      client.role === 'Buyer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {client.role}
                    </span>
                  </div>
                  <PhaseBadge phase={client.phase} />
                </div>

                <p className="text-muted text-xs mb-3 truncate">{client.address}</p>

                <div className="flex flex-col gap-2">
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-navy min-h-[44px]"
                    >
                      <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {client.phone}
                    </a>
                  )}
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-navy min-h-[44px] truncate"
                    >
                      <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {client.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
