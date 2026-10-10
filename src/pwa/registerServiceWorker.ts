import { registerSW } from 'virtual:pwa-register'
import { repositories } from '../db/repositories.ts'
import { handleUpdateAvailable, isTypingInField } from './autoUpdate.ts'
import { setSwState } from './swState.ts'

/**
 * Registers the service worker in production builds only. Every time the app opens, and every
 * time it comes back to the foreground, it checks for a new version and applies it when that is
 * safe. Failures never break the app.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  try {
    const update = registerSW({
      onOfflineReady: () => setSwState({ offlineReady: true }),
      onNeedRefresh: () => {
        void handleUpdateAvailable({
          uptimeMs: () => performance.now(),
          sessionInProgress: async () => Boolean(await repositories.gymSessions.findInProgress()),
          typing: () => isTypingInField(),
          apply: () => update(true),
          setState: setSwState,
        })
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        const check = () => void registration.update().catch(() => undefined)
        check()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
      },
    })
    setSwState({ applyUpdate: () => update(true) })
  } catch {
    // Offline support is an enhancement; the app still works online without it.
  }
}
