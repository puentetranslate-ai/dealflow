import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  HomeIcon, UsersIcon, DollarIcon, SettingsIcon, CalendarIcon, LogoutIcon,
} from './Icon'

const links = [
  { path: '/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { path: '/clients', label: 'Clients', Icon: UsersIcon },
  { path: '/commission', label: 'Commission', Icon: DollarIcon },
  { path: '/calendar', label: 'Calendar', Icon: CalendarIcon, comingSoon: true },
  { path: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setFullName(data?.full_name || user.user_metadata?.full_name || '')
        }
      })
    return () => { cancelled = true }
  }, [user.id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = (fullName || user.email || '?')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[280px] bg-navy text-white z-40">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Deal<span className="text-gold">Flow</span>
        </h1>
        <p className="text-muted text-xs font-medium mt-1 tracking-wide">Agent Workspace</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {links.map(({ path, label, Icon, comingSoon }) =>
          comingSoon ? (
            <div
              key={path}
              className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-white/30 font-medium cursor-not-allowed select-none"
              title="Coming soon"
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-gold/60">
                Soon
              </span>
            </div>
          ) : (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* Upgrade card */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-navy-light border border-gold/20 p-4">
          <div className="badge-gold mb-2">Pro</div>
          <h3 className="font-display text-base font-bold text-white leading-tight">
            Upgrade to Pro
          </h3>
          <p className="text-white/60 text-xs mt-1 leading-snug">
            Unlock document storage, e-signatures, and team workspaces.
          </p>
          <button
            onClick={() => alert('Upgrade flow coming soon.')}
            className="mt-3 w-full bg-gold text-navy font-semibold text-sm rounded-lg py-2 hover:bg-gold-light transition-colors"
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* Agent footer */}
      <div className="px-4 py-4 mt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/20 text-gold font-bold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate leading-tight">
              {fullName || 'Agent'}
            </p>
            <p className="text-white/50 text-xs truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white/40 hover:text-gold p-2 -mr-2 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogoutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
