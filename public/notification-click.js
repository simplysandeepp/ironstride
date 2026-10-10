// Loaded by the service worker. Tapping a reminder notification opens the app on the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data
  const path = data && typeof data.url === 'string' ? data.url : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      if (!open) return self.clients.openWindow(path)
      // The app is already running: bring it forward and let it move on its own, without a
      // reload, so a workout in progress is not lost.
      return open.focus().then(() => open.postMessage({ type: 'open-path', path }))
    }),
  )
})
