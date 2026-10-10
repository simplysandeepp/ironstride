import { useOnlineStatus } from '../hooks/useOnlineStatus.ts'

/** Quiet status line. Offline is a normal state: everything still works and saves locally. */
export function OfflineIndicator() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <p className="offline-pill" role="status">
      Offline. Everything still works and saves on this device.
    </p>
  )
}
