import { useLocation, useNavigate } from 'react-router-dom'
import { HomeIcon, UsersIcon, DollarIcon, SettingsIcon } from './Icon'

const tabs = [
  { path: '/dashboard', label: 'Home', Icon: HomeIcon },
  { path: '/clients', label: 'Clients', Icon: UsersIcon },
  { path: '/commission', label: 'Commission', Icon: DollarIcon },
  { path: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-navy/[0.06] z-50 pb-safe">
      <div className="flex">
        {tabs.map(({ path, label, Icon }) => {
          const active = location.pathname.startsWith(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-h-[56px] transition-colors ${
                active ? 'text-navy' : 'text-muted'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-gold rounded-b-full" />
              )}
              <Icon className="w-6 h-6" />
              <span className={`text-[10px] font-semibold ${active ? 'text-navy' : 'text-muted'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
