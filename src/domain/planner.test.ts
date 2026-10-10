import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../data/trainingProgramme.ts'
import { getWeekRunKm } from './programme.ts'
import {
  applyOverrides,
  getPlannedWorkoutsForDate,
  getScaleFactor,
  getWeekNumberForDate,
  getWorkoutDate,
  scaleProgrammeToBaseline,
} from './planner.ts'

const P = DEFAULT_PROGRAMME
const START = '2026-10-12' // a Monday

describe('scaleProgrammeToBaseline', () => {
  it('leaves the programme alone when the base already supports week 1', () => {
    expect(scaleProgrammeToBaseline(P, 18, 10)).toBe(P)
    expect(scaleProgrammeToBaseline(P, 25, 12)).toBe(P)
  })

  it('never scales the programme up', () => {
    expect(getScaleFactor(P, 40, 20)).toBe(1)
  })

  it('scales down for a lower base so week 1 stays within 10% of it', () => {
    const scaled = scaleProgrammeToBaseline(P, 12, 8)
    expect(getWeekRunKm(scaled.weeks[0])).toBeLessThanOrEqual(12 * 1.1 + 1)
    expect(getWeekRunKm(scaled.weeks[0])).toBeLessThan(getWeekRunKm(P.weeks[0]))
  })

  it('limits week 1 by a short recent long run too', () => {
    const scaled = scaleProgrammeToBaseline(P, 20, 5)
    const long = scaled.weeks[0].workouts.find((w) => w.type === 'long-run')!
    expect(long.plannedDistanceKm).toBeLessThanOrEqual(5.5 + 0.5)
  })

  it('keeps every run at least 1 km, in 0.5 km steps, and leaves gym sessions untouched', () => {
    const scaled = scaleProgrammeToBaseline(P, 5, 3)
    for (const week of scaled.weeks) {
      for (const w of week.workouts) {
        if (w.plannedDistanceKm !== undefined) {
          expect(w.plannedDistanceKm).toBeGreaterThanOrEqual(1)
          expect((w.plannedDistanceKm * 2) % 1).toBe(0)
        }
      }
    }
    expect(scaled.weeks[0].workouts.find((w) => w.type === 'gym')).toEqual(
      P.weeks[0].workouts.find((w) => w.type === 'gym'),
    )
  })

  it('ignores invalid baselines', () => {
    expect(scaleProgrammeToBaseline(P, 0, 0)).toBe(P)
    expect(scaleProgrammeToBaseline(P, Number.NaN, 10)).toBe(P)
  })

  it('does not mutate the default programme', () => {
    const before = getWeekRunKm(P.weeks[0])
    scaleProgrammeToBaseline(P, 10, 6)
    expect(getWeekRunKm(P.weeks[0])).toBe(before)
  })
})

describe('applyOverrides', () => {
  it('edits one workout and recalculates the weekly total', () => {
    const target = P.weeks[0].workouts.find((w) => w.type === 'long-run')!
    const edited = applyOverrides(P, [
      { id: target.id, weekNumber: 1, dayOfWeek: 6, plannedDistanceKm: 9 },
    ])
    expect(getWeekRunKm(edited.weeks[0])).toBe(getWeekRunKm(P.weeks[0]) - 7 + 9)
    expect(getWeekRunKm(P.weeks[0])).toBe(19)
    expect(getWeekRunKm(edited.weeks[1])).toBe(getWeekRunKm(P.weeks[1]))
  })

  it('returns the same programme when there are no overrides', () => {
    expect(applyOverrides(P, [])).toBe(P)
  })
})

describe('date mapping', () => {
  it('maps the start date and the following days to week 1', () => {
    expect(getWeekNumberForDate('2026-10-12', START, 26)).toBe(1)
    expect(getWeekNumberForDate('2026-10-18', START, 26)).toBe(1)
    expect(getWeekNumberForDate('2026-10-19', START, 26)).toBe(2)
  })

  it('returns nothing before the start or after week 26', () => {
    expect(getWeekNumberForDate('2026-10-11', START, 26)).toBeUndefined()
    expect(getWeekNumberForDate('2027-04-12', START, 26)).toBeUndefined()
    expect(getPlannedWorkoutsForDate(P, '2026-10-11', START)).toEqual([])
  })

  it('treats the last Sunday of week 26 as part of the programme', () => {
    expect(getWeekNumberForDate('2027-04-11', START, 26)).toBe(26)
  })

  it('returns both sessions on a Monday and a rest day on Sunday', () => {
    const monday = getPlannedWorkoutsForDate(P, START, START)
    expect(monday.map((w) => w.type)).toEqual(['gym', 'easy-run'])
    const sunday = getPlannedWorkoutsForDate(P, '2026-10-18', START)
    expect(sunday.map((w) => w.type)).toEqual(['rest'])
  })

  it('starts mid-week without planning days before the start date', () => {
    const wed = '2026-10-14'
    expect(getPlannedWorkoutsForDate(P, '2026-10-13', wed)).toEqual([])
    expect(getPlannedWorkoutsForDate(P, wed, wed).map((w) => w.type)).toEqual(['gym'])
  })

  it('round-trips workout dates', () => {
    for (const week of [P.weeks[0], P.weeks[13], P.weeks[25]]) {
      for (const w of week.workouts) {
        const date = getWorkoutDate(w, START)
        expect(getPlannedWorkoutsForDate(P, date, START).map((x) => x.id)).toContain(w.id)
      }
    }
  })
})
