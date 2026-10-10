import { registerSW } from 'virtual:pwa-register'
import { setSwState } from './swState.ts'

/** Registers the service worker in production builds only. Failures never break the app. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  try {
    const update = registerSW({
      onOfflineReady: () => setSwState({ offlineReady: true }),
      onNeedRefresh: () => setSwState({ needRefresh: true }),
    })
    setSwState({ applyUpdate: () => update(true) })
  } catch {
    // Offline support is an enhancement; the app still works online without it.
  }
}
