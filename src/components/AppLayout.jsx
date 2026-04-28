import Sidebar from './Sidebar'
import HamburgerDrawer from './HamburgerDrawer'
import QuickLogModal from './QuickLogModal'
import { QuickLogFab } from './QuickLogTrigger'
import { MobileDrawerProvider } from '../context/MobileDrawerContext'
import { QuickLogProvider } from '../context/QuickLogContext'

// Wraps every protected page with the proper chrome:
//   - mobile: hamburger drawer (no bottom nav)
//   - desktop (md:): fixed left sidebar with content offset
//   - global: Quick-Log modal mounted once + secondary FAB on mobile

export default function AppLayout({ children }) {
  return (
    <MobileDrawerProvider>
      <QuickLogProvider>
        <div className="min-h-screen bg-cream">
          <Sidebar />
          <main className="md:ml-[280px] min-h-screen">
            {children}
          </main>
          <HamburgerDrawer />
          <QuickLogFab />
          <QuickLogModal />
        </div>
      </QuickLogProvider>
    </MobileDrawerProvider>
  )
}
