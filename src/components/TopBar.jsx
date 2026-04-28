import { useNavigate } from 'react-router-dom'
import { SearchIcon, PlusIcon, BellIcon } from './Icon'

export default function TopBar({ search, onSearchChange, searchPlaceholder = 'Search deals, clients, addresses…' }) {
  const navigate = useNavigate()

  return (
    <div className="hidden md:flex items-center gap-4 px-8 pt-6 pb-4 sticky top-0 z-30 bg-cream/95 backdrop-blur">
      <div className="relative flex-1 max-w-xl">
        <SearchIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search ?? ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-white border border-navy/[0.06] rounded-xl pl-11 pr-4 py-2.5 text-sm text-navy placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-xl bg-white border border-navy/[0.06] hover:border-gold/40 text-navy flex items-center justify-center transition-colors"
        >
          <BellIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/deals/new')}
          className="bg-navy text-white hover:bg-navy-light font-semibold text-sm rounded-xl pl-4 pr-5 h-10 flex items-center gap-2 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Deal
        </button>
      </div>
    </div>
  )
}
