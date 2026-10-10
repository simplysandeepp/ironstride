import { describe, expect, it, vi } from 'vitest'
import script from '../../public/notification-click.js?raw'

type Listener = (event: unknown) => void

/** Runs the real service-worker script against a fake worker scope. */
function load(
  windows: { focus: ReturnType<typeof vi.fn>; postMessage?: ReturnType<typeof vi.fn> }[],
) {
  const listeners: Record<string, Listener> = {}
  const scope = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    clients: {
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  }
  new Function('self', script)(scope)
  const click = async (data?: unknown) => {
    let pending: Promise<unknown> = Promise.resolve()
    const notification = { close: vi.fn(), data }
    listeners.notificationclick({
      notification,
      waitUntil: (p: Promise<unknown>) => (pending = p),
    })
    await pending
    return notification
  }
  return { scope, click }
}

describe('notification tap', () => {
  it('closes the notification, brings the open app forward and tells it where to go', async () => {
    const focus = vi.fn().mockResolvedValue(undefined)
    const postMessage = vi.fn()
    const { scope, click } = load([{ focus, postMessage }])
    const n = await click({ url: '/run' })
    expect(n.close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(postMessage).toHaveBeenCalledWith({ type: 'open-path', path: '/run' })
    expect(scope.clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens the app straight on that screen when it is not running', async () => {
    const { scope, click } = load([])
    await click({ url: '/nutrition' })
    expect(scope.clients.openWindow).toHaveBeenCalledWith('/nutrition')
  })

  it('opens the start page when the notification carries no address', async () => {
    const { scope, click } = load([])
    await click(undefined)
    expect(scope.clients.openWindow).toHaveBeenCalledWith('/')
  })
})
