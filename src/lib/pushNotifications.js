// Browser notification helpers.
//
// IMPORTANT: real Web Push delivery (notify when app is closed) requires a
// server-side component to call webpush.send() with VAPID keys. This file
// covers the client side only:
//   - check support
//   - request permission
//   - subscribe to push (creates a PushSubscription via the existing service worker)
//   - persist the subscription to Supabase (`push_subscriptions` table)
//   - show local Notifications when the app is open (via the SW registration)
//
// To wire up real off-app push later, add a Vercel/Supabase Edge Function
// that reads push_subscriptions and fires webpush.send() with a private VAPID
// key on a cron schedule. Then set VITE_PUSH_PUBLIC_KEY in your env.

import { supabase } from './supabase'

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const getNotificationPermission = () =>
  isPushSupported() ? Notification.permission : 'denied'

// Request OS permission. Returns 'granted' | 'denied' | 'default'.
export async function requestPermission() {
  if (!isPushSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

// VAPID public key — set VITE_PUSH_PUBLIC_KEY in env to enable subscribing
// for off-app push delivery. Without it we still register the SW and can fire
// in-app notifications, but PushManager.subscribe will fail.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUSH_PUBLIC_KEY || null

export async function subscribeToPush(userId) {
  if (!isPushSupported()) throw new Error('Push not supported in this browser.')
  const perm = await requestPermission()
  if (perm !== 'granted') throw new Error('Notification permission denied.')

  const reg = await navigator.serviceWorker.ready

  let subscription = null
  if (VAPID_PUBLIC_KEY) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // Persist whatever subscription we got. If VAPID isn't configured, we still
  // track that the user opted in so future server-side delivery can pick them up.
  await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        subscription: subscription ? subscription.toJSON() : { client_only: true },
      },
      { onConflict: 'user_id' }
    )

  return subscription
}

export async function unsubscribeFromPush(userId) {
  try {
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
  } catch {}
  await supabase.from('push_subscriptions').delete().eq('user_id', userId)
}

// Show an in-app notification right now, via the active service worker if one
// exists (better visual fidelity, supports actions/badges) or fall back to the
// plain Notification constructor.
export async function showLocalNotification(title, options = {}) {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        ...options,
      })
      return
    }
  } catch {}
  try { new Notification(title, options) } catch {}
}

// Daily check — looks for items the agent should know about TODAY:
//   - Checklist items due today (orange) or overdue (red)
//   - Lead follow-ups due today (purple)
//   - Showings within the next 2 hours (cyan)
//   - Closings 7 days out and 1 day out (gold)
// Avoids re-firing the same alert by stamping localStorage per item per day.
export async function runDailyNotificationCheck(userId) {
  if (!isPushSupported() || Notification.permission !== 'granted') return

  const today = new Date()
  const todayKey = today.toISOString().split('T')[0]
  const stampKey = `notify-fired:${userId}:${todayKey}`
  const fired = new Set((localStorage.getItem(stampKey) || '').split(',').filter(Boolean))
  // `data.url` is consumed by public/sw-custom.js — when the user taps
  // the notification, the SW reads this URL and routes them to the
  // matching page in the app.
  const fire = async (id, title, body, url) => {
    if (fired.has(id)) return
    fired.add(id)
    await showLocalNotification(title, {
      body,
      tag: id,
      data: { url: url || '/dashboard' },
    })
  }

  try {
    const sevenDays = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const oneDay   = new Date(today.getTime() + 1 * 86400000).toISOString().split('T')[0]

    const [checklist, leads, deals, showings] = await Promise.all([
      supabase.from('checklist_items')
        .select('id, label, deal_id, due_date, deals(address)')
        .eq('user_id', userId).eq('is_checked', false)
        .lte('due_date', todayKey),
      supabase.from('leads')
        .select('id, first_name, last_name, follow_up_date')
        .eq('user_id', userId)
        .eq('follow_up_date', todayKey)
        .is('converted_to_deal_id', null),
      supabase.from('deals')
        .select('id, address, closing_date')
        .eq('user_id', userId)
        .neq('phase', 'Closed')
        .in('closing_date', [todayKey, oneDay, sevenDays]),
      supabase.from('showings')
        .select('id, property_address, showing_date, showing_time')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .eq('showing_date', todayKey),
    ])

    for (const c of (checklist.data || [])) {
      const overdue = c.due_date < todayKey
      const addr = c.deals?.address || 'a deal'
      await fire(
        `check-${c.id}`,
        overdue ? '🔴 Overdue task' : '📋 Due today',
        `${c.label} on ${addr}`,
        c.deal_id ? `/deals/${c.deal_id}` : '/dashboard'
      )
    }

    for (const l of (leads.data || [])) {
      await fire(
        `lead-${l.id}`,
        '👤 Follow up today',
        `${l.first_name} ${l.last_name}`,
        '/leads'
      )
    }

    for (const d of (deals.data || [])) {
      const dealUrl = `/deals/${d.id}`
      if (d.closing_date === sevenDays) {
        await fire(`close7-${d.id}`, '🔑 Closing in 7 days', d.address, dealUrl)
      } else if (d.closing_date === oneDay) {
        await fire(`close1-${d.id}`, '🔑 Tomorrow: Closing', d.address, dealUrl)
      } else if (d.closing_date === todayKey) {
        await fire(`close0-${d.id}`, '🔑 Closing today!', d.address, dealUrl)
      }
    }

    for (const s of (showings.data || [])) {
      if (s.showing_time) {
        const showingAt = new Date(`${s.showing_date}T${s.showing_time}`)
        const diffH = (showingAt - today) / 3600000
        if (diffH > 0 && diffH <= 2.25) {
          await fire(
            `show-${s.id}`,
            '🏠 Showing in 2 hours',
            s.property_address,
            '/calendar'
          )
        }
      }
    }

    localStorage.setItem(stampKey, [...fired].join(','))
  } catch {
    // Silent — notifications are nice-to-have, never block the app.
  }
}

// Standard VAPID base64-url → Uint8Array conversion
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
