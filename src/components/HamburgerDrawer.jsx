import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useMobileDrawer } from '../context/MobileDrawerContext'
import {
  HomeIcon, FunnelIcon, UsersIcon, BarChartIcon, SettingsIcon, CalendarIcon,
  XIcon, LogoutIcon, NetworkIcon,
} from './Icon'

const links = [
  { path: '/dashboard', label: 'Home', Icon: HomeIcon },
  { path: '/leads', label: 'Leads', Icon: FunnelIcon },
  { path: '/clients', label: 'Clients', Icon: UsersIcon },
  { path: '/commission', label: 'Intelligence', Icon: BarChartIcon },
  { path: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { path: '/settings', label: 'Settings', Icon: SettingsIcon },
  { path: '/agent-network', label: 'Agent Network', Icon: NetworkIcon },
]

// Slide-out mobile drawer. Lives in AppLayout; opened by the hamburger
// in MobileHeader; closed by tap-outside or the X button.
//
// Hidden entirely on md+ where the persistent Sidebar takes over.

export default function HamburgerDrawer() {
  const { open, setOpen } = useMobileDrawer()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const fullName = user?.user_metadata?.full_name || ''
  const initials = (fullName || user?.email || '?')
    .split(/[\s@]+/).filter(Boolean).slice(0, 2)
    .map((s) => s[0]).join('').toUpperCase()

  return (
    <div
      className={`md:hidden fixed inset-0 z-[60] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-navy/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`absolute left-0 top-0 bottom-0 w-[280px] max-w-[82vw] bg-navy text-white flex flex-col shadow-pop transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Top: logo + close */}
        <div className="px-5 pt-safe">
          <div className="pt-5 pb-3 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Deal<span className="text-gold">Flow</span>
              </h1>
              <p className="text-muted text-[11px] font-medium mt-0.5 tracking-wide">Agent Workspace</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="w-10 h-10 -mr-2 rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {links.map(({ path, label, Icon, comingSoon }) =>
            comingSoon ? (
              <div
                key={path}
                className="relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/30 font-medium cursor-not-allowed select-none min-h-[48px]"
              >
                <Icon className="w-5 h-5" />
                <span className="text-base">{label}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-gold/60">
                  Soon
                </span>
              </div>
            ) : (
              <NavLink
                key={path}
                to={path}
                end={path === '/dashboard'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-colors min-h-[48px] ${
                    isActive
                      ? 'bg-white/[0.06] text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-gold rounded-r-full" />
                    )}
                    <Icon className="w-5 h-5" />
                    <span className="text-base">{label}</span>
                  </>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* Footer: agent identity + sign out */}
        <div className="px-4 py-4 mt-2 border-t border-white/[0.06] pb-safe">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold/20 text-gold font-bold text-sm flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {fullName || 'Agent'}
              </p>
              <p className="text-white/50 text-xs truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="w-10 h-10 rounded-full text-white/40 hover:text-gold hover:bg-white/[0.04] flex items-center justify-center transition-colors"
            >
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
