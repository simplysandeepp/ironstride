// Loaded by the service worker. Without this, tapping a reminder notification does nothing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Bring the open app forward without reloading it, so a workout in progress is untouched.
      const open = windows.find((w) => 'focus' in w)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
