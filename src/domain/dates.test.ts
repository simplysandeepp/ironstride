import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  getDateRange,
  getDayOfWeek,
  getLastNDays,
  getLocalDateKey,
  getWeekDays,
  getWeekStart,
  isDateKey,
} from './dates.ts'

describe('isDateKey', () => {
  it('accepts real dates including leap days', () => {
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2026-10-10')).toBe(true)
  })

  it('rejects malformed or impossible dates', () => {
    expect(isDateKey('2025-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('10/10/2026')).toBe(false)
    expect(isDateKey('')).toBe(false)
  })
})

describe('getLocalDateKey', () => {
  it('uses the requested timezone, not UTC', () => {
    const instant = new Date('2026-10-10T20:30:00Z')
    expect(getLocalDateKey(instant, 'Asia/Kolkata')).toBe('2026-10-11')
    expect(getLocalDateKey(instant, 'America/Los_Angeles')).toBe('2026-10-10')
  })

  it('uses India Standard Time by default, whatever the device zone is', () => {
    // 20:30 UTC on 10 Oct is already 02:00 on 11 Oct in India.
    expect(getLocalDateKey(new Date('2026-10-10T20:30:00Z'))).toBe('2026-10-11')
    // 23:59 in India on 5 Jan is still 5 Jan, even though it is 18:29 UTC.
    expect(getLocalDateKey(new Date('2026-01-05T23:59:00+05:30'))).toBe('2026-01-05')
    expect(getLocalDateKey(new Date('2026-01-06T00:00:00+05:30'))).toBe('2026-01-06')
  })
})

describe('addDays / daysBetween', () => {
  it('crosses month, year and leap-year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('is not affected by daylight-saving changes', () => {
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetween('2026-11-01', '2026-10-01')).toBe(-31)
  })

  it('throws on invalid keys', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError)
  })
})

describe('week helpers', () => {
  it('finds the Monday week start by default', () => {
    expect(getDayOfWeek('2026-10-10')).toBe(6) // Saturday
    expect(getWeekStart('2026-10-10')).toBe('2026-10-05')
    expect(getWeekStart('2026-10-05')).toBe('2026-10-05')
    expect(getWeekStart('2026-10-11')).toBe('2026-10-05') // Sunday belongs to the previous Monday
  })

  it('supports a Sunday week start', () => {
    expect(getWeekStart('2026-10-10', 0)).toBe('2026-10-04')
  })

  it('lists seven days', () => {
    expect(getWeekDays('2026-10-10')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
  })
})

describe('ranges', () => {
  it('returns an inclusive range', () => {
    expect(getDateRange('2026-10-08', '2026-10-10')).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
    expect(getDateRange('2026-10-10', '2026-10-08')).toEqual([])
  })

  it('returns exactly 365 days ending today, across a leap year', () => {
    const days = getLastNDays('2024-12-31', 365)
    expect(days).toHaveLength(365)
    expect(days[364]).toBe('2024-12-31')
    expect(days[0]).toBe('2024-01-02')
    expect(getLastNDays('2025-12-31', 365)[0]).toBe('2025-01-01')
  })

  it('handles zero or negative lengths', () => {
    expect(getLastNDays('2026-10-10', 0)).toEqual([])
  })
})
