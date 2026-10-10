/**
 * Tiny external store for service worker status, so the UI can show
 * "ready offline" and (next) "update available" without a state library.
 */
export type SwState = {
  offlineReady: boolean
  needRefresh: boolean
  /** A new version is being applied automatically right now. */
  autoUpdating?: boolean
  /** Applies a waiting update and reloads. Set by the registration code. */
  applyUpdate?: () => Promise<void>
}

let state: SwState = { offlineReady: false, needRefresh: false }
const listeners = new Set<() => void>()

export const getSwState = () => state

export function setSwState(patch: Partial<SwState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeSwState(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
