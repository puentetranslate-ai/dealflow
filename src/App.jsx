import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TrialProvider } from './context/TrialContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import ClientPortal from './pages/ClientPortal'
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Dashboard from './pages/Dashboard'
import DealForm from './pages/DealForm'
import DealDetail from './pages/DealDetail'
import ClientDirectory from './pages/ClientDirectory'
import Intelligence from './pages/Intelligence'
import Calendar from './pages/Calendar'
import Leads from './pages/Leads'
import LeadForm from './pages/LeadForm'
import AgentNetwork from './pages/AgentNetwork'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <NotificationNavigator />
      <AuthProvider>
        <TrialProvider>
        <SubscriptionProvider>
        <Routes>
          {/* Public marketing + auth routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Public client portal — no auth, gated by RLS via the token */}
          <Route path="/portal/:token" element={<ClientPortal />} />

          {/* Protected app routes — redirect to /login if not authenticated */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/deals/new" element={<DealForm />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/deals/:id/edit" element={<DealForm />} />
            <Route path="/clients" element={<ClientDirectory />} />
            <Route path="/commission" element={<Intelligence />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/new" element={<LeadForm />} />
            <Route path="/leads/:id/edit" element={<LeadForm />} />
            <Route path="/agent-network" element={<AgentNetwork />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          {/* Unknown URLs land on the landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SubscriptionProvider>
        </TrialProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

// Listens for messages posted from the service worker after a notification
// is tapped. The SW (public/sw-custom.js) sends `{ type: 'NAVIGATE', url }`
// when an existing tab gets focused — we route there via React Router so
// the navigation feels instant instead of a full page reload.
function NotificationNavigator() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event) => {
      const data = event.data
      if (data && data.type === 'NAVIGATE' && typeof data.url === 'string') {
        navigate(data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
  return null
}
