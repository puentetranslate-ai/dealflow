/* eslint-disable no-restricted-globals */
// Custom service-worker handlers — imported into the workbox-generated SW
// via the `workbox.importScripts` option in vite.config.js. Runs in the
// ServiceWorkerGlobalScope, so `self` refers to the SW itself.
//
// Responsible for routing notification clicks back into the app:
//   - close the notification
//   - if a DealFlow tab is already open, focus it and tell the SPA to
//     navigate via postMessage (handled by NotificationNavigator in App.jsx)
//   - otherwise open a new window at the target URL
//
// Each notification's payload carries data.url — produced in
// src/lib/pushNotifications.js. If url is missing, we fall back to /dashboard.

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification?.data?.url || '/dashboard'

  event.waitUntil(
    (async () => {
      try {
        const all = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })

        // Reuse an open DealFlow tab when possible — gives an instant
        // SPA transition instead of a full page reload.
        const existing = all.find((c) => c.url.startsWith(self.location.origin))
        if (existing) {
          if ('focus' in existing) {
            try { await existing.focus() } catch {}
          }
          existing.postMessage({ type: 'NAVIGATE', url: targetUrl })
          return
        }

        // No tab open — launch a fresh window straight to the target page.
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl)
        }
      } catch (err) {
        // Notification clicks must never crash the SW.
        // eslint-disable-next-line no-console
        console.error('[sw-custom] notificationclick failed:', err)
      }
    })()
  )
})
