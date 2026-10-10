import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Only app paths: never another site, and never a protocol-relative address. */
export const isAppPath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

/** Moves to the screen a tapped notification asked for when the app was already open. */
export function useNotificationNavigation() {
  const navigate = useNavigate()
  useEffect(() => {
    const container = navigator.serviceWorker
    if (!container) return
    const onMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; path?: unknown } | null
      if (message?.type === 'open-path' && isAppPath(message.path)) navigate(message.path)
    }
    container.addEventListener('message', onMessage)
    return () => container.removeEventListener('message', onMessage)
  }, [navigate])
}
