import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

// Wraps every protected page with the proper chrome:
//   - mobile: bottom nav + safe-area padding
//   - desktop (md:): fixed left sidebar with content offset
//
// Pages render their own top bar/header so each can customize search,
// title, etc. — AppLayout just provides the shell.

export default function AppLayout({ children, hideBottomNav = false }) {
  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <main className="md:ml-[280px] min-h-screen">
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
