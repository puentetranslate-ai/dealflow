import Sidebar from './Sidebar'
import HamburgerDrawer from './HamburgerDrawer'
import QuickLogModal from './QuickLogModal'
import { QuickLogFab } from './QuickLogTrigger'
import TrialGate from './TrialGate'
import TrialModal from './TrialModal'
import { MobileDrawerProvider } from '../context/MobileDrawerContext'
import { QuickLogProvider } from '../context/QuickLogContext'

// Wraps every protected page with the proper chrome:
//   - mobile: hamburger drawer (no bottom nav)
//   - desktop (md:): fixed left sidebar with content offset
//   - global: Quick-Log modal mounted once + secondary FAB on mobile
//
// TrialGate replaces the entire protected-page tree with a "Trial expired"
// view when the user's 30-day trial has ended. TrialModal renders a one-
// time-per-session warning at the 1-day-remaining threshold.

export default function AppLayout({ children }) {
  return (
    <MobileDrawerProvider>
      <QuickLogProvider>
        <TrialGate>
          <div className="min-h-screen bg-cream">
            <Sidebar />
            <main className="md:ml-[280px] min-h-screen">
              {children}
            </main>
            <HamburgerDrawer />
            <QuickLogFab />
            <QuickLogModal />
            <TrialModal />
          </div>
        </TrialGate>
      </QuickLogProvider>
    </MobileDrawerProvider>
  )
}
