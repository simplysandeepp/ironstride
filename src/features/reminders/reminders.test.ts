import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Reminder } from '../../domain/types.ts'
import {
  DEFAULT_REMINDERS,
  describeSupport,
  firedKey,
  getDueReminders,
  getNotificationSupport,
  isInQuietHours,
  isValidTime,
  LATE_WINDOW_MINUTES,
  LIMITS_NOTE,
  mergeReminders,
  type ReminderMemory,
} from './reminders.ts'

const none: ReminderMemory = { fired: new Set(), snoozedUntil: {} }
// Monday 12 October 2026, local time
const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m)
const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'gym',
  title: 'Gym',
  type: 'gym',
  enabled: true,
  timeLocal: '07:30',
  weekdays: [1],
  ...over,
})

describe('defaults', () => {
  it('start switched off, with valid times and weekdays', () => {
    const all = mergeReminders([])
    expect(all.length).toBe(DEFAULT_REMINDERS.length)
    for (const r of all) {
      expect(r.enabled, r.id).toBe(false)
      expect(isValidTime(r.timeLocal), r.id).toBe(true)
      expect(r.weekdays.length, r.id).toBeGreaterThan(0)
    }
  })

  it('matches the plan: gym Mon/Wed/Fri, run Mon/Tue/Thu/Sat, recovery prompt on Sunday', () => {
    const by = Object.fromEntries(mergeReminders([]).map((r) => [r.id, r.weekdays]))
    expect(by.gym).toEqual([1, 3, 5])
    expect(by.run).toEqual([1, 2, 4, 6])
    expect(by.rest).toEqual([0])
  })

  it('keeps saved changes and still lists reminders the user never touched', () => {
    const merged = mergeReminders([reminder({ id: 'gym', enabled: true, timeLocal: '18:00' })])
    expect(merged.find((r) => r.id === 'gym')).toMatchObject({ enabled: true, timeLocal: '18:00' })
    expect(merged.find((r) => r.id === 'run')?.enabled).toBe(false)
  })
})

describe('isValidTime and quiet hours', () => {
  it('validates HH:MM', () => {
    for (const ok of ['00:00', '07:30', '23:59']) expect(isValidTime(ok)).toBe(true)
    for (const bad of ['', '7:30', '24:00', '12:60', 'abc']) expect(isValidTime(bad)).toBe(false)
  })

  it('handles a daytime window', () => {
    expect(isInQuietHours('13:00', '12:00', '14:00')).toBe(true)
    expect(isInQuietHours('14:00', '12:00', '14:00')).toBe(false)
  })

  it('handles a window that wraps midnight', () => {
    expect(isInQuietHours('23:30', '22:00', '07:00')).toBe(true)
    expect(isInQuietHours('03:00', '22:00', '07:00')).toBe(true)
    expect(isInQuietHours('07:00', '22:00', '07:00')).toBe(false)
    expect(isInQuietHours('12:00', '22:00', '07:00')).toBe(false)
  })

  it('means no quiet hours when unset, equal or invalid', () => {
    expect(isInQuietHours('03:00')).toBe(false)
    expect(isInQuietHours('03:00', '22:00', '22:00')).toBe(false)
    expect(isInQuietHours('03:00', 'x', '07:00')).toBe(false)
  })
})

describe('getDueReminders', () => {
  it('is due from its time until the late window ends', () => {
    expect(getDueReminders([reminder()], at(7, 29), none)).toEqual([])
    expect(getDueReminders([reminder()], at(7, 30), none)).toHaveLength(1)
    expect(getDueReminders([reminder()], at(9, 30), none)).toHaveLength(1)
    expect(getDueReminders([reminder()], at(9, 31), none)).toEqual([])
    expect(LATE_WINDOW_MINUTES).toBe(120)
  })

  it('ignores disabled reminders and other weekdays', () => {
    expect(getDueReminders([reminder({ enabled: false })], at(8), none)).toEqual([])
    expect(getDueReminders([reminder({ weekdays: [2, 3] })], at(8), none)).toEqual([])
  })

  it('does not repeat once handled today, but returns the next day', () => {
    const handled: ReminderMemory = {
      fired: new Set([firedKey('2026-10-12', 'gym')]),
      snoozedUntil: {},
    }
    expect(getDueReminders([reminder()], at(8), handled)).toEqual([])
    const nextMonday = new Date(2026, 9, 19, 8)
    expect(getDueReminders([reminder()], nextMonday, handled)).toHaveLength(1)
  })

  it('stays hidden while snoozed and returns after', () => {
    const snoozed: ReminderMemory = { fired: new Set(), snoozedUntil: { gym: at(8, 10).getTime() } }
    expect(getDueReminders([reminder()], at(8, 5), snoozed)).toEqual([])
    expect(getDueReminders([reminder()], at(8, 10), snoozed)).toHaveLength(1)
  })

  it('shows nothing during quiet hours', () => {
    expect(
      getDueReminders([reminder({ timeLocal: '06:00' })], at(6, 30), none, {
        start: '22:00',
        end: '07:00',
      }),
    ).toEqual([])
  })

  it('ignores reminders with a corrupt time instead of throwing', () => {
    expect(getDueReminders([reminder({ timeLocal: 'garbage' })], at(8), none)).toEqual([])
  })
})

describe('notification support wording', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is honest when notifications are unsupported', () => {
    vi.stubGlobal('Notification', undefined)
    const s = getNotificationSupport()
    expect(s).toEqual({ supported: false, permission: 'unsupported' })
    expect(describeSupport(s)).toMatch(/does not support notifications/i)
  })

  it('describes each permission state and never promises background delivery', () => {
    expect(describeSupport({ supported: true, permission: 'default' })).toMatch(/not enabled yet/i)
    expect(describeSupport({ supported: true, permission: 'granted' })).toMatch(/allowed/i)
    expect(describeSupport({ supported: true, permission: 'denied' })).toMatch(/blocked/i)
    expect(LIMITS_NOTE).toMatch(/may not run a web app in the background/i)
    expect(LIMITS_NOTE).toMatch(/alarm in your Clock app/i)
  })
})
