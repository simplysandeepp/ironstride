import { describe, expect, it, vi } from 'vitest'
import {
  AUTO_UPDATE_WINDOW_MS,
  canAutoUpdate,
  handleUpdateAvailable,
  isTypingInField,
  type AutoUpdateDeps,
} from './autoUpdate.ts'
import type { SwState } from './swState.ts'

describe('canAutoUpdate', () => {
  const ok = { uptimeMs: 5_000, sessionInProgress: false, typing: false }

  it('allows an update just after opening when nothing is in progress', () => {
    expect(canAutoUpdate(ok)).toBe(true)
    expect(canAutoUpdate({ ...ok, uptimeMs: AUTO_UPDATE_WINDOW_MS })).toBe(true)
  })

  it('refuses once the app has been open a while, or a workout or typing is under way', () => {
    expect(canAutoUpdate({ ...ok, uptimeMs: AUTO_UPDATE_WINDOW_MS + 1 })).toBe(false)
    expect(canAutoUpdate({ ...ok, sessionInProgress: true })).toBe(false)
    expect(canAutoUpdate({ ...ok, typing: true })).toBe(false)
  })
})

function setup(over: Partial<AutoUpdateDeps> = {}) {
  const state: Partial<SwState> = {}
  const deps: AutoUpdateDeps = {
    uptimeMs: () => 3_000,
    sessionInProgress: async () => false,
    typing: () => false,
    apply: vi.fn().mockResolvedValue(undefined),
    setState: (patch) => Object.assign(state, patch),
    ...over,
  }
  return { deps, state }
}

describe('handleUpdateAvailable', () => {
  it('applies the update quietly when it is safe, without ever showing the banner', async () => {
    const { deps, state } = setup()
    expect(await handleUpdateAvailable(deps)).toBe('applied')
    expect(deps.apply).toHaveBeenCalledTimes(1)
    expect(state).toEqual({ autoUpdating: true })
  })

  it('shows the banner instead when the app has been open for a while', async () => {
    const { deps, state } = setup({ uptimeMs: () => AUTO_UPDATE_WINDOW_MS + 5_000 })
    expect(await handleUpdateAvailable(deps)).toBe('prompted')
    expect(deps.apply).not.toHaveBeenCalled()
    expect(state).toEqual({ needRefresh: true })
  })

  it('never reloads under a workout in progress', async () => {
    const { deps, state } = setup({ sessionInProgress: async () => true })
    expect(await handleUpdateAvailable(deps)).toBe('prompted')
    expect(deps.apply).not.toHaveBeenCalled()
    expect(state.needRefresh).toBe(true)
  })

  it('never reloads while a field is being typed in', async () => {
    const { deps } = setup({ typing: () => true })
    expect(await handleUpdateAvailable(deps)).toBe('prompted')
    expect(deps.apply).not.toHaveBeenCalled()
  })

  it('asks the user when it cannot tell whether a workout is open', async () => {
    const { deps } = setup({
      sessionInProgress: async () => Promise.reject(new Error('db closed')),
    })
    expect(await handleUpdateAvailable(deps)).toBe('prompted')
    expect(deps.apply).not.toHaveBeenCalled()
  })

  it('falls back to the banner if applying the update fails', async () => {
    const { deps, state } = setup({ apply: vi.fn().mockRejectedValue(new Error('network')) })
    expect(await handleUpdateAvailable(deps)).toBe('failed')
    expect(state).toEqual({ autoUpdating: false, needRefresh: true })
  })
})

describe('isTypingInField', () => {
  const doc = (tag: string, type?: string) => ({
    activeElement: { tagName: tag, type } as unknown as Element,
  })

  it('is true for text fields, text areas and dropdowns', () => {
    expect(isTypingInField(doc('INPUT', 'text'))).toBe(true)
    expect(isTypingInField(doc('INPUT', 'number'))).toBe(true)
    expect(isTypingInField(doc('TEXTAREA'))).toBe(true)
    expect(isTypingInField(doc('SELECT'))).toBe(true)
  })

  it('is false for buttons, checkboxes and when nothing has focus', () => {
    expect(isTypingInField(doc('BUTTON'))).toBe(false)
    expect(isTypingInField(doc('INPUT', 'checkbox'))).toBe(false)
    expect(isTypingInField(doc('INPUT', 'submit'))).toBe(false)
    expect(isTypingInField({ activeElement: null })).toBe(false)
  })
})
