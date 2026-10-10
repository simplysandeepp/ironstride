import { describe, expect, it } from 'vitest'
import { getWeeklyAverages, getWeightTrend, suggestCalorieAdjustment } from './weightTrend.ts'
import type { BodyMeasurement } from './types.ts'

const m = (date: string, weightKg?: number): BodyMeasurement => ({ id: date, date, weightKg })

describe('getWeightTrend', () => {
  it('is empty with no data and ignores entries without weight', () => {
    expect(getWeightTrend([])).toEqual([])
    expect(getWeightTrend([m('2026-10-10')])).toEqual([])
  })

  it('shows actual points only, with no rolling average until 3 entries exist', () => {
    const trend = getWeightTrend([m('2026-10-01', 66), m('2026-10-03', 66.4)])
    expect(trend).toEqual([
      { date: '2026-10-01', weightKg: 66 },
      { date: '2026-10-03', weightKg: 66.4 },
    ])
  })

  it('adds a 7-day rolling average once 3 entries are in the window', () => {
    const trend = getWeightTrend([
      m('2026-10-05', 66),
      m('2026-10-06', 66.6),
      m('2026-10-07', 66.3),
      m('2026-10-20', 67),
    ])
    expect(trend[2].rollingAvgKg).toBe(66.3)
    expect(trend[3].rollingAvgKg).toBeUndefined()
  })
})

describe('weekly averages and suggestions', () => {
  const week = (start: string, avgKg: number) => ({ weekStart: start, avgKg, entries: 5 })

  it('groups by Monday-start week', () => {
    const avgs = getWeeklyAverages([m('2026-10-05', 66), m('2026-10-11', 67), m('2026-10-12', 68)])
    expect(avgs).toEqual([
      { weekStart: '2026-10-05', avgKg: 66.5, entries: 2 },
      { weekStart: '2026-10-12', avgKg: 68, entries: 1 },
    ])
  })

  it('needs at least 3 weeks of averages before suggesting anything', () => {
    expect(suggestCalorieAdjustment([week('a', 66), week('b', 66)], { targetMaxKg: 75 })).toBeNull()
  })

  it('suggests adding calories when the average is flat, never as an automatic change', () => {
    const s = suggestCalorieAdjustment([week('a', 66), week('b', 66), week('c', 66.05)], {
      targetMaxKg: 75,
    })
    expect(s?.deltaKcal).toBe(150)
  })

  it('suggests nothing when weight is rising at a sensible pace', () => {
    expect(
      suggestCalorieAdjustment([week('a', 66), week('b', 66.3), week('c', 66.6)], {
        targetMaxKg: 75,
      }),
    ).toBeNull()
  })

  it('suggests reviewing portions only when gain is rapid and the waist is rising', () => {
    const weeks = [week('a', 66), week('b', 67), week('c', 68)]
    expect(suggestCalorieAdjustment(weeks, { targetMaxKg: 75 })).toBeNull()
    expect(suggestCalorieAdjustment(weeks, { targetMaxKg: 75, waistRising: true })?.deltaKcal).toBe(
      -150,
    )
  })

  it('does not push calories up once the target maximum is reached', () => {
    expect(
      suggestCalorieAdjustment([week('a', 75), week('b', 75), week('c', 75)], { targetMaxKg: 75 }),
    ).toBeNull()
  })
})
