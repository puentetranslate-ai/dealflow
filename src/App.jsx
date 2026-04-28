import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
import CommissionTracker from './pages/CommissionTracker'
import Leads from './pages/Leads'
import LeadForm from './pages/LeadForm'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route path="/commission" element={<CommissionTracker />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/new" element={<LeadForm />} />
            <Route path="/leads/:id/edit" element={<LeadForm />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Unknown URLs land on the landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
