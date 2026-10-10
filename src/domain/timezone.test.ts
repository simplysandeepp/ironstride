import { describe, expect, it } from 'vitest'
import { getLocalDateKey } from './dates.ts'
import { APP_TIME_ZONE, formatDateTime, getZonedTimeOfDay } from './timezone.ts'

describe('India Standard Time', () => {
  it('is the app time zone', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Kolkata')
  })

  it('reads the time of day in IST from any instant', () => {
    expect(getZonedTimeOfDay(new Date('2026-10-12T07:30:00Z'))).toBe('13:00')
    expect(getZonedTimeOfDay(new Date('2026-10-12T18:29:00Z'))).toBe('23:59')
    expect(getZonedTimeOfDay(new Date('2026-10-12T18:30:00Z'))).toBe('00:00')
  })

  it('uses a 24-hour clock with leading zeros and never "24:xx"', () => {
    expect(getZonedTimeOfDay(new Date('2026-10-12T00:35:00+05:30'))).toBe('00:35')
    expect(getZonedTimeOfDay(new Date('2026-10-12T09:05:00+05:30'))).toBe('09:05')
  })

  it('moves the date at IST midnight, not UTC midnight', () => {
    expect(getLocalDateKey(new Date('2026-10-12T18:29:59Z'))).toBe('2026-10-12')
    expect(getLocalDateKey(new Date('2026-10-12T18:30:00Z'))).toBe('2026-10-13')
  })

  it('still supports an explicit other zone', () => {
    expect(getLocalDateKey(new Date('2026-10-12T18:30:00Z'), 'America/Los_Angeles')).toBe(
      '2026-10-12',
    )
    expect(getZonedTimeOfDay(new Date('2026-10-12T18:30:00Z'), 'UTC')).toBe('18:30')
  })

  it('formats a stored timestamp for display with its zone label', () => {
    expect(formatDateTime('2026-10-10T07:35:00.000Z')).toBe('10 Oct, 13:05 IST')
    expect(formatDateTime('2026-10-10T20:30:00.000Z')).toBe('11 Oct, 02:00 IST')
  })

  it('returns an unreadable timestamp unchanged instead of showing "Invalid Date"', () => {
    expect(formatDateTime('not a date')).toBe('not a date')
  })
})
