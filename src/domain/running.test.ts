import { describe, expect, it } from 'vitest'
import {
  calculateRunPace,
  calculateWeeklyRunDistance,
  formatPace,
  parsePace,
  validateRunLog,
} from './running.ts'
import type { RunLog } from './types.ts'

const run = (date: string, km: number, completed = true): RunLog => ({
  id: `${date}-${km}`,
  date,
  type: 'easy',
  actualDistanceKm: km,
  completed,
})

describe('pace', () => {
  it('computes seconds per km and formats it', () => {
    expect(calculateRunPace(5, 1650)).toBe(330)
    expect(formatPace(330)).toBe('5:30')
    expect(formatPace(359.6)).toBe('6:00')
  })

  it('returns nothing for zero, negative or invalid input', () => {
    expect(calculateRunPace(0, 1000)).toBeUndefined()
    expect(calculateRunPace(5, 0)).toBeUndefined()
    expect(calculateRunPace(-1, 100)).toBeUndefined()
    expect(calculateRunPace(Number.NaN, 100)).toBeUndefined()
    expect(formatPace(undefined)).toBe('--')
  })

  it('parses m:ss input', () => {
    expect(parsePace('5:30')).toBe(330)
    expect(parsePace('5.5')).toBeUndefined()
    expect(parsePace('5:75')).toBeUndefined()
  })
})

describe('weekly distance', () => {
  it('sums only completed runs in that Monday-Sunday week', () => {
    const logs = [
      run('2026-10-12', 5),
      run('2026-10-15', 5.5),
      run('2026-10-17', 8, false),
      run('2026-10-18', 10),
      run('2026-10-19', 6),
    ]
    expect(calculateWeeklyRunDistance(logs, '2026-10-14')).toBe(20.5)
  })
})

describe('validateRunLog', () => {
  it('flags bad distance, duration and effort', () => {
    expect(validateRunLog({ actualDistanceKm: 5, durationSeconds: 1500, rpe: 4 })).toEqual({})
    expect(validateRunLog({ actualDistanceKm: -1, durationSeconds: 0, rpe: 11 })).toEqual({
      distance: expect.any(String),
      duration: expect.any(String),
      rpe: expect.any(String),
    })
  })
})

import { formatDuration, getLoadWarning, parseDuration } from './running.ts'

describe('duration', () => {
  it('parses minutes, mm:ss and h:mm:ss', () => {
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('27:30')).toBe(1650)
    expect(parseDuration('1:05:30')).toBe(3930)
    expect(parseDuration('37.5')).toBe(2250)
  })

  it('rejects junk, zero and out-of-range parts', () => {
    for (const bad of ['', 'abc', '0', '5:75', '1:2:3:4', '-5', '0:00']) {
      expect(parseDuration(bad), bad).toBeUndefined()
    }
  })

  it('formats seconds back to text', () => {
    expect(formatDuration(1650)).toBe('27:30')
    expect(formatDuration(3930)).toBe('1:05:30')
    expect(formatDuration(undefined)).toBe('')
  })
})

describe('getLoadWarning', () => {
  it('stays quiet when the plan is near what you run', () => {
    expect(getLoadWarning(22, 18)).toBeUndefined()
    expect(getLoadWarning(22.5, 18)).toBeUndefined()
  })

  it('warns when the plan is well above the base and recent weeks', () => {
    expect(getLoadWarning(30, 18, [15, 20])).toContain('30 km')
  })

  it('uses a stronger recent week as the reference, so keeping up removes the warning', () => {
    expect(getLoadWarning(30, 18, [26])).toBeUndefined()
  })

  it('does nothing without a usable base', () => {
    expect(getLoadWarning(30, 0)).toBeUndefined()
  })
})

import { getWeeklyRunSummaries } from './running.ts'

describe('getWeeklyRunSummaries', () => {
  const run = (date: string, km: number, completed = true): RunLog => ({
    id: date + km,
    date,
    type: 'easy',
    actualDistanceKm: km,
    completed,
  })

  it('returns oldest-first weeks ending with the current one, with zeros for empty weeks', () => {
    const out = getWeeklyRunSummaries(
      [
        run('2026-10-06', 5),
        run('2026-10-10', 10),
        run('2026-10-12', 6),
        run('2026-10-13', 4, false),
      ],
      '2026-10-14',
      3,
    )
    expect(out.map((w) => w.weekStart)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(out.map((w) => w.km)).toEqual([0, 15, 6])
    expect(out.map((w) => w.longestRunKm)).toEqual([0, 10, 6])
  })

  it('handles no data', () => {
    expect(getWeeklyRunSummaries([], '2026-10-14', 2).every((w) => w.km === 0)).toBe(true)
  })
})
