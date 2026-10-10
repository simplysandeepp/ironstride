import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './useAutoBackup.ts'

const setStorage = (value: unknown) =>
  Object.defineProperty(navigator, 'storage', { value, configurable: true })

afterEach(() => setStorage(undefined))

describe('requestPersistentStorage', () => {
  it('asks the browser to keep the data and reports the answer', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    setStorage({ persisted: async () => false, persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask again when storage is already protected', async () => {
    const persist = vi.fn()
    setStorage({ persisted: async () => true, persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('copes with browsers that have no storage API, or one that throws', async () => {
    setStorage(undefined)
    expect(await requestPersistentStorage()).toBe(false)
    setStorage({
      persisted: async () => {
        throw new Error('blocked')
      },
    })
    expect(await requestPersistentStorage()).toBe(false)
  })
})
