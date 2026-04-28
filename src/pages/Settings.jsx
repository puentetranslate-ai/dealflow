import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import TopBar from '../components/TopBar'
import MobileHeader from '../components/MobileHeader'
import LoadingSpinner from '../components/LoadingSpinner'
import { LogoutIcon, LockIcon, EyeIcon, EyeOffIcon, CheckIcon, BellIcon } from '../components/Icon'
import {
  isPushSupported, getNotificationPermission, subscribeToPush, unsubscribeFromPush,
} from '../lib/pushNotifications'

export default function Settings() {
  const { user, signOut, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const [fullName, setFullName] = useState('')
  const [defaultCommission, setDefaultCommission] = useState('')
  const [deadlineNotifs, setDeadlineNotifs] = useState(true)

  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const [pwError, setPwError] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [user.id])

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      setDefaultCommission(data.default_commission_pct != null ? String(data.default_commission_pct) : '3')
      setDeadlineNotifs(data.deadline_notifications !== false)
    } else {
      setFullName(user.user_metadata?.full_name || '')
      setDefaultCommission('3')
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true); setSaveMsg(null)
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
    if (pwForm.newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await updatePassword(pwForm.newPw)
    setPwSaving(false)
    if (error) setPwError(error.message)
    else {
      setPwMsg('Password updated!')
      setPwForm({ newPw: '', confirmPw: '' })
      setTimeout(() => setPwMsg(null), 3000)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <MobileHeader eyebrow="ACCOUNT" title="Settings" />
      <TopBar />

      <div className="hidden md:block px-8 pt-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Account</p>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">Settings</h1>
      </div>

      <div className="px-5 md:px-8 pt-4 pb-32 md:pb-12 max-w-3xl">
        <div className="space-y-5">
          {/* Profile */}
          <div className="card p-5 md:p-6">
            <SectionHeader title="Profile" subtitle="Your agent identity in DealFlow" />

            <div className="space-y-4 mt-4">
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
                <div className="input-field bg-cream/60 text-muted cursor-not-allowed select-none">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="label">Default Commission %</label>
                <div className="relative">
                  <input
                    type="number"
                    value={defaultCommission}
                    onChange={(e) => setDefaultCommission(e.target.value)}
                    className="input-field pr-10"
                    placeholder="3.0"
                    inputMode="decimal"
                    step="0.1"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">%</span>
                </div>
                <p className="text-xs text-muted mt-1">Pre-fills on new deals.</p>
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-navy font-semibold text-sm">Deadline Notifications</p>
                  <p className="text-muted text-xs mt-0.5">Alerts for upcoming due dates.</p>
                </div>
                <button
                  onClick={() => setDeadlineNotifs((v) => !v)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${deadlineNotifs ? 'bg-gold' : 'bg-navy/15'}`}
                  aria-pressed={deadlineNotifs}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${deadlineNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {saveMsg && (
                <p className={`text-sm font-medium ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {saveMsg}
                </p>
              )}

              <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
                {saving ? <LoadingSpinner size="sm" /> : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="card p-5 md:p-6">
            <SectionHeader title="Change Password" subtitle="Update the password for your account" />

            <div className="space-y-4 mt-4">
              {pwError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-sm">
                  {pwError}
                </div>
              )}
              {pwMsg && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-green-700 text-sm flex items-center gap-2">
                  <CheckIcon className="w-4 h-4" /> {pwMsg}
                </div>
              )}

              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.newPw}
                    onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
                    className="input-with-icon pr-12"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-navy transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.confirmPw}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirmPw: e.target.value }))}
                    className="input-with-icon"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button onClick={changePassword} disabled={pwSaving} className="btn-outline w-full">
                {pwSaving ? <LoadingSpinner size="sm" /> : 'Update Password'}
              </button>
            </div>
          </div>

          {/* Notifications */}
          <NotificationsCard userId={user.id} />

          {/* Upgrade card */}
          <div className="rounded-2xl bg-navy text-white p-6 md:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -translate-y-16 translate-x-12 pointer-events-none" />
            <div className="badge-gold relative">Pro</div>
            <h3 className="font-display text-xl md:text-2xl font-bold mt-3 relative leading-tight">
              Upgrade to <span className="text-gold">Pro</span>
            </h3>
            <p className="text-white/70 text-sm mt-2 relative max-w-md">
              Unlock document storage, e-signatures, team workspaces, and AI-powered transaction summaries.
            </p>
            <button
              onClick={() => alert('Upgrade flow coming soon.')}
              className="mt-5 inline-flex items-center justify-center bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-6 h-11 relative transition-colors"
            >
              Upgrade Now
            </button>
          </div>

          {/* Sign Out */}
          <div className="card p-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-red-500 font-semibold rounded-xl min-h-[48px] hover:bg-red-50 transition-colors"
            >
              <LogoutIcon className="w-5 h-5" />
              Sign Out
            </button>
          </div>

          <p className="text-center text-muted text-xs pb-2">
            DealFlow v1.0 · Built for real estate professionals
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      {subtitle && <p className="text-muted text-xs mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─────────────────────────── Notifications card ───────────────────────────
const NOTIF_TYPES = [
  { id: 'deadlines',  label: 'Checklist deadlines',    desc: 'Due-today + overdue items' },
  { id: 'leads',      label: 'Lead follow-ups',        desc: 'Reminders for follow-up dates' },
  { id: 'showings',   label: 'Showings',               desc: '2 hours before a showing' },
  { id: 'closings',   label: 'Closings',               desc: '7 and 1 days before closing' },
]

function NotificationsCard({ userId }) {
  const [supported] = useState(() => isPushSupported())
  const [permission, setPermission] = useState(() => getNotificationPermission())
  const [enabled, setEnabled] = useState(() => permission === 'granted' && localStorage.getItem('push-enabled') === 'true')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)
  const [types, setTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif-types') || '{}') }
    catch { return {} }
  })

  const saveTypes = (next) => {
    setTypes(next)
    localStorage.setItem('notif-types', JSON.stringify(next))
  }

  const handleToggle = async () => {
    setError(null); setWorking(true)
    try {
      if (enabled) {
        await unsubscribeFromPush(userId)
        localStorage.setItem('push-enabled', 'false')
        setEnabled(false)
      } else {
        await subscribeToPush(userId)
        localStorage.setItem('push-enabled', 'true')
        setEnabled(true)
        setPermission('granted')
      }
    } catch (e) {
      setError(e.message)
    }
    setWorking(false)
  }

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center shrink-0 mt-0.5">
          <BellIcon className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <SectionHeader title="Notifications" subtitle="Get nudges for what's due today and what's coming up." />
        </div>
      </div>

      {!supported && (
        <p className="text-muted text-xs mt-3">
          This browser doesn't support web push notifications.
        </p>
      )}

      {supported && permission === 'denied' && (
        <p className="text-red-500 text-xs mt-3">
          Notifications are blocked at the browser level. Update your browser's site settings to enable them, then come back.
        </p>
      )}

      {supported && permission !== 'denied' && (
        <>
          <div className="flex items-center justify-between mt-4 py-1">
            <div>
              <p className="text-navy font-semibold text-sm">Enable push notifications</p>
              <p className="text-muted text-xs mt-0.5">
                Browser will ask for permission the first time you turn this on.
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={working}
              aria-pressed={enabled}
              className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-gold' : 'bg-navy/15'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-3 text-red-600 text-xs">
              {error}
            </div>
          )}

          {enabled && (
            <div className="mt-4 pt-4 border-t border-navy/[0.05] space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Send me notifications for</p>
              {NOTIF_TYPES.map((t) => {
                const on = types[t.id] !== false // default true
                return (
                  <div key={t.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-navy text-sm font-medium">{t.label}</p>
                      <p className="text-muted text-xs">{t.desc}</p>
                    </div>
                    <button
                      onClick={() => saveTypes({ ...types, [t.id]: !on })}
                      aria-pressed={on}
                      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-gold' : 'bg-navy/15'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )
              })}
              <p className="text-[11px] text-muted/80 italic pt-2">
                Note: real "ping you when the app is closed" delivery requires server-side wiring (VAPID + cron). Right now you'll see notifications fire when DealFlow is open.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
