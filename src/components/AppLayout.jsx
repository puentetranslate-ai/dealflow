import Sidebar from './Sidebar'
import HamburgerDrawer from './HamburgerDrawer'
import { MobileDrawerProvider } from '../context/MobileDrawerContext'

// Wraps every protected page with the proper chrome:
//   - mobile: hamburger drawer (no bottom nav)
//   - desktop (md:): fixed left sidebar with content offset
//
// Pages render their own top bar/header so each can customize search,
// title, etc. — AppLayout just provides the shell.

export default function AppLayout({ children }) {
  return (
    <MobileDrawerProvider>
      <div className="min-h-screen bg-cream">
        <Sidebar />
        <main className="md:ml-[280px] min-h-screen">
          {children}
        </main>
        <HamburgerDrawer />
      </div>
    </MobileDrawerProvider>
  )
}
