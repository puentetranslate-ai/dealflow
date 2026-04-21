import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import BottomNav from '../components/BottomNav'

export default function Settings() {
  const { user, signOut, updatePassword } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const [fullName, setFullName] = useState('')
  const [defaultCommission, setDefaultCommission] = useState('')
  const [deadlineNotifs, setDeadlineNotifs] = useState(true)

  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const [pwError, setPwError] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [user.id])

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      setDefaultCommission(data.default_commission_pct != null ? String(data.default_commission_pct) : '3')
      setDeadlineNotifs(data.deadline_notifications !== false)
    } else {
      const name = user.user_metadata?.full_name || ''
      setFullName(name)
      setDefaultCommission('3')
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaveMsg(null)
    const payload = {
      id: user.id,
      full_name: fullName,
      default_commission_pct: defaultCommission ? parseFloat(defaultCommission) : 3,
      deadline_notifications: deadlineNotifs,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(payload)
    setSaving(false)
    setSaveMsg(error ? `Error: ${error.message}` : 'Saved!')
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const changePassword = async () => {
    setPwError(null)
    if (pwForm.newPw.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (pwForm.newPw !== pwForm.confirmPw) {
      setPwError('Passwords do not match.')
      return
    }
    setPwSaving(true)
    const { error } = await updatePassword(pwForm.newPw)
    setPwSaving(false)
    if (error) {
      setPwError(error.message)
    } else {
      setPwMsg('Password updated!')
      setPwForm({ newPw: '', confirmPw: '' })
      setTimeout(() => setPwMsg(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <div className="bg-navy px-4 pt-14 pb-6 sticky top-0 z-40">
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Profile */}
        <div className="card p-5 space-y-4">
          <p className="section-title">Profile</p>

          <div>
            <label className="label">Agent Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <div className="input-field bg-gray-50 text-muted cursor-not-allowed select-none">
              {user.email}
            </div>
          </div>

          <div>
            <label className="label">Default Commission %</label>
            <input
              type="number"
              value={defaultCommission}
              onChange={(e) => setDefaultCommission(e.target.value)}
              className="input-field"
              placeholder="3.0"
              inputMode="decimal"
              step="0.1"
            />
            <p className="text-xs text-muted mt-1">Pre-fills on new deals</p>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-navy font-medium text-sm">Deadline Notifications</p>
              <p className="text-muted text-xs mt-0.5">Alerts for upcoming due dates</p>
            </div>
            <button
              onClick={() => setDeadlineNotifs((v) => !v)}
              className={`relative w-12 h-7 rounded-full transition-colors ${deadlineNotifs ? 'bg-gold' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${deadlineNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {saveMsg && (
            <p className={`text-sm font-medium ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {saveMsg}
            </p>
          )}

          <button onClick={saveProfile} disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size="sm" /> : 'Save Changes'}
          </button>
        </div>

        {/* Change Password */}
        <div className="card p-5 space-y-4">
          <p className="section-title">Change Password</p>

          {pwError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-xs">
              {pwError}
            </div>
          )}
          {pwMsg && (
            <p className="text-green-600 text-sm font-medium">{pwMsg}</p>
          )}

          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={pwForm.newPw}
              onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
              className="input-field"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirmPw}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPw: e.target.value }))}
              className="input-field"
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>

          <button onClick={changePassword} disabled={pwSaving} className="btn-outline">
            {pwSaving ? <LoadingSpinner size="sm" /> : 'Update Password'}
          </button>
        </div>

        {/* Sign Out */}
        <div className="card p-5">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-semibold min-h-[48px] active:opacity-70"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>

        <p className="text-center text-muted text-xs pb-2">
          DealFlow v1.0 · Built for real estate professionals
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
