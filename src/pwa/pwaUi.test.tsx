import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OfflineIndicator } from '../components/OfflineIndicator.tsx'
import { InstallHelp } from '../features/settings/InstallHelp.tsx'
import { getSwState, setSwState, subscribeSwState } from './swState.ts'

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

describe('OfflineIndicator', () => {
  it('is hidden online and reassuring offline', () => {
    setOnline(true)
    render(<OfflineIndicator />)
    expect(screen.queryByRole('status')).toBeNull()
    act(() => setOnline(false))
    expect(screen.getByRole('status')).toHaveTextContent(/still works and saves on this device/i)
    act(() => setOnline(true))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('InstallHelp', () => {
  it('explains installing without claiming it happens automatically', () => {
    render(<InstallHelp />)
    expect(screen.getByText(/install app/i)).toBeInTheDocument()
    expect(screen.getByText(/only you can approve the install/i)).toBeInTheDocument()
    expect(screen.getByText(/clearing site data/i)).toBeInTheDocument()
  })

  it('reflects when the service worker reports offline readiness', () => {
    render(<InstallHelp />)
    expect(screen.getByText(/also opens offline/i)).toBeInTheDocument()
    act(() => setSwState({ offlineReady: true }))
    expect(screen.getByText(/ready to work offline/i)).toBeInTheDocument()
    act(() => setSwState({ offlineReady: false }))
  })
})

describe('swState store', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    let calls = 0
    const off = subscribeSwState(() => calls++)
    setSwState({ needRefresh: true })
    expect(calls).toBe(1)
    expect(getSwState().needRefresh).toBe(true)
    off()
    setSwState({ needRefresh: false })
    expect(calls).toBe(1)
  })
})
