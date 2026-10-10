/** Shows a system notification if the user allowed it. Returns false when it could not. */
export async function showSystemNotification(
  title: string,
  body: string,
  options: { path?: string; tag?: string } = {},
): Promise<boolean> {
  const { path = '/', tag = title } = options
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    const registration =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        tag,
        data: { url: path },
      })
    } else {
      new Notification(title, { body, icon: '/icons/icon-192.png', tag, data: { url: path } })
    }
    return true
  } catch {
    return false
  }
}

/** Only call this from a tap, after the user has read why we ask. */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}
