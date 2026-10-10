import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setSwState } from '../pwa/swState.ts'
import { UpdatePrompt } from './UpdatePrompt.tsx'

afterEach(() =>
  act(() => setSwState({ needRefresh: false, autoUpdating: false, applyUpdate: undefined })),
)

describe('UpdatePrompt', () => {
  it('stays hidden until an update is waiting', () => {
    render(<UpdatePrompt />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers a refresh that only applies when chosen, and reassures about data', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    render(<UpdatePrompt />)
    act(() => setSwState({ needRefresh: true, applyUpdate: apply }))
    expect(screen.getByRole('status')).toHaveTextContent(/your logs are not affected/i)
    expect(apply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh now' }))
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('can be postponed with Later', async () => {
    render(<UpdatePrompt />)
    act(() => setSwState({ needRefresh: true, applyUpdate: vi.fn() }))
    await userEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('lets you retry if applying the update fails, without breaking the app', async () => {
    const apply = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined)
    render(<UpdatePrompt />)
    act(() => setSwState({ needRefresh: true, applyUpdate: apply }))
    await userEvent.click(screen.getByRole('button', { name: 'Refresh now' }))
    expect(await screen.findByRole('button', { name: 'Refresh now' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh now' }))
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it('says it is updating while a safe automatic update is applied, with nothing to tap', () => {
    render(<UpdatePrompt />)
    act(() => setSwState({ autoUpdating: true }))
    expect(screen.getByRole('status')).toHaveTextContent(/updating ironstride/i)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('still shows the tap-to-refresh banner when an update could not be applied automatically', () => {
    render(<UpdatePrompt />)
    act(() => setSwState({ needRefresh: true, autoUpdating: false, applyUpdate: vi.fn() }))
    expect(screen.getByRole('button', { name: 'Refresh now' })).toBeInTheDocument()
  })
})
