import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/database.ts'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import { ReminderBanner } from './ReminderBanner.tsx'
import { RemindersSection } from './RemindersSection.tsx'

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

function stubNotification(permission: NotificationPermission, request = vi.fn()) {
  const ctor = vi.fn() as unknown as typeof Notification
  Object.assign(ctor, { permission, requestPermission: request })
  vi.stubGlobal('Notification', ctor)
  return ctor
}

describe('RemindersSection', () => {
  it('shows the limits and that notifications are unsupported when they are', async () => {
    vi.stubGlobal('Notification', undefined)
    render(<RemindersSection />)
    expect(await screen.findByText(/may not run a web app in the background/i)).toBeInTheDocument()
    expect(screen.getByText(/does not support notifications/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enable notifications/i })).toBeNull()
  })

  it('asks for permission only when the button is tapped', async () => {
    const request = vi.fn().mockResolvedValue('granted')
    stubNotification('default', request)
    render(<RemindersSection />)
    const button = await screen.findByRole('button', { name: 'Enable notifications' })
    expect(request).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(request).toHaveBeenCalledTimes(1)
    await waitFor(async () =>
      expect((await repositories.settings.get()).notificationsEnabled).toBe(true),
    )
  })

  it('does not claim notifications are on when permission is denied', async () => {
    stubNotification('default', vi.fn().mockResolvedValue('denied'))
    render(<RemindersSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }))
    await waitFor(async () =>
      expect((await repositories.settings.get()).notificationsEnabled).toBe(false),
    )
  })

  it('enables a reminder, then edits its time and days', async () => {
    stubNotification('denied')
    render(<RemindersSection />)
    expect(screen.queryByLabelText(/time for gym session today/i)).toBeNull()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Gym session today' }))
    const time = await screen.findByLabelText(/time for gym session today/i)
    // Native time pickers deliver a complete value in one change.
    fireEvent.change(time, { target: { value: '18:15' } })
    const tuesday = screen.getByRole('button', { name: 'Tue' })
    await userEvent.click(tuesday)
    await waitFor(async () => {
      const saved = await db.reminders.get('gym')
      expect(saved).toMatchObject({ enabled: true, timeLocal: '18:15' })
      expect(saved?.weekdays).toEqual([1, 2, 3, 5])
    })
  })

  it('saves quiet hours', async () => {
    stubNotification('denied')
    render(<RemindersSection />)
    await userEvent.type(await screen.findByLabelText('Quiet from'), '22:00')
    await userEvent.type(screen.getByLabelText('Quiet until'), '07:00')
    await waitFor(async () => {
      const s = await repositories.settings.get()
      expect([s.quietHoursStart, s.quietHoursEnd]).toEqual(['22:00', '07:00'])
    })
  })
})

describe('ReminderBanner', () => {
  const monday =
    (h: number, m = 0) =>
    () =>
      new Date(2026, 9, 12, h, m)

  async function enableGym() {
    await repositories.settings.save({ ...DEFAULT_SETTINGS })
    await db.reminders.put({
      id: 'gym',
      title: 'Gym session today',
      type: 'gym',
      enabled: true,
      timeLocal: '07:30',
      weekdays: [1],
    })
  }

  it('stays hidden before the time and with nothing enabled', async () => {
    await enableGym()
    render(<ReminderBanner now={monday(7, 0)} />)
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(screen.queryByRole('status', { name: 'Reminder' })).toBeNull()
  })

  it('shows a due reminder in the app, and Done hides it for the day', async () => {
    await enableGym()
    render(<ReminderBanner now={monday(8, 0)} />)
    expect(await screen.findByText(/gym session today/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText(/gym session today/i)).toBeNull()
    expect(localStorage.getItem('ironstride.reminderMemory')).toContain('2026-10-12|gym')
  })

  it('snoozes for 10 minutes', async () => {
    await enableGym()
    render(<ReminderBanner now={monday(8, 0)} />)
    await userEvent.click(await screen.findByRole('button', { name: /snooze 10 min/i }))
    expect(screen.queryByText(/gym session today/i)).toBeNull()
    const memory = JSON.parse(localStorage.getItem('ironstride.reminderMemory') ?? '{}')
    expect(memory.snoozedUntil.gym).toBe(new Date(2026, 9, 12, 8, 10).getTime())
  })

  it('posts a system notification only when notifications are enabled and allowed', async () => {
    await enableGym()
    await repositories.settings.save({ ...DEFAULT_SETTINGS, notificationsEnabled: true })
    const ctor = stubNotification('granted')
    render(<ReminderBanner now={monday(8, 0)} />)
    await screen.findByText(/gym session today/i)
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1))
    expect(ctor).toHaveBeenCalledWith(
      'IronStride',
      expect.objectContaining({ body: 'Gym session today' }),
    )
  })

  it('does not post a system notification without permission', async () => {
    await enableGym()
    await repositories.settings.save({ ...DEFAULT_SETTINGS, notificationsEnabled: true })
    const ctor = stubNotification('denied')
    render(<ReminderBanner now={monday(8, 0)} />)
    await screen.findByText(/gym session today/i)
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(ctor).not.toHaveBeenCalled()
  })
})
