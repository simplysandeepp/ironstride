import { describe, expect, it } from 'vitest'
import {
  getWeekGymSessions,
  getWeekRunKm,
  getWeekRunSessions,
  isRunWorkout,
  type ProgrammeWeek,
} from '../domain/programme.ts'
import { getExercise } from './exerciseLibrary.ts'
import { DEFAULT_PROGRAMME } from './trainingProgramme.ts'

const weeks = DEFAULT_PROGRAMME.weeks
const km = (w: ProgrammeWeek) => getWeekRunKm(w)

describe('default programme structure', () => {
  it('has 26 numbered weeks', () => {
    expect(weeks).toHaveLength(26)
    expect(weeks.map((w) => w.weekNumber)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1))
  })

  it('keeps Sunday as a full rest day with no sessions', () => {
    for (const w of weeks) {
      const sunday = w.workouts.filter((x) => x.dayOfWeek === 0)
      expect(
        sunday.map((x) => x.type),
        `week ${w.weekNumber}`,
      ).toEqual(['rest'])
    }
  })

  it('schedules 3 gym sessions and 4 runs each week on the agreed days', () => {
    for (const w of weeks) {
      expect(getWeekGymSessions(w)).toBe(3)
      expect(getWeekRunSessions(w)).toBe(4)
      const dayOf = (type: string) => w.workouts.find((x) => x.type === type)?.dayOfWeek
      expect(dayOf('easy-run')).toBe(1)
      expect(dayOf('interval-run')).toBe(2)
      expect(dayOf('tempo-run')).toBe(4)
      expect(dayOf('long-run')).toBe(6)
      expect(w.workouts.filter((x) => x.type === 'gym').map((x) => x.dayOfWeek)).toEqual([1, 3, 5])
    }
  })

  it('never places a run on the lower-body day', () => {
    for (const w of weeks) {
      expect(w.workouts.filter((x) => x.dayOfWeek === 3 && isRunWorkout(x))).toHaveLength(0)
    }
  })

  it('has unique workout ids', () => {
    const ids = weeks.flatMap((w) => w.workouts.map((x) => x.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('running volume', () => {
  it('computes weekly totals from the individual runs', () => {
    const w1 = weeks[0]
    const sum = w1.workouts.reduce(
      (s, x) => s + (isRunWorkout(x) ? (x.plannedDistanceKm ?? 0) : 0),
      0,
    )
    expect(km(w1)).toBe(sum)
    expect(km(w1)).toBe(19)
  })

  it('starts near the current 15-20 km base and builds toward the agreed targets', () => {
    expect(km(weeks[0])).toBeLessThanOrEqual(21)
    const wk7 = weeks[6]
    expect(
      wk7.workouts.find((x) => x.type === 'easy-run')?.plannedDistanceKm,
    ).toBeGreaterThanOrEqual(5)
    const longRuns = weeks.map(
      (w) => w.workouts.find((x) => x.type === 'long-run')?.plannedDistanceKm ?? 0,
    )
    expect(longRuns.some((d) => d >= 10)).toBe(true)
    expect(Math.max(...weeks.map(km))).toBeLessThanOrEqual(35)
  })

  it('includes a cutback week at least every fourth week', () => {
    const cutbacks = weeks.filter((w) => w.isCutback).map((w) => w.weekNumber)
    expect(cutbacks).toEqual([4, 8, 12, 16, 20, 24])
    for (const n of cutbacks) {
      expect(km(weeks[n - 1]), `week ${n}`).toBeLessThan(km(weeks[n - 2]) * 0.9)
    }
  })

  it('never jumps more than 12% week to week outside of recovery rebounds', () => {
    for (let i = 1; i < weeks.length; i++) {
      const prev = weeks[i - 1]
      if (prev.isCutback) continue
      const growth = km(weeks[i]) / km(prev) - 1
      if (weeks[i].isCutback) continue
      expect(growth, `week ${i + 1}`).toBeLessThanOrEqual(0.12)
    }
  })

  it('follows the indicative weekly range per phase', () => {
    const within = (from: number, to: number, lo: number, hi: number) => {
      for (let n = from; n <= to; n++) {
        const w = weeks[n - 1]
        if (w.isCutback) continue
        expect(km(w), `week ${n}`).toBeGreaterThanOrEqual(lo)
        expect(km(w), `week ${n}`).toBeLessThanOrEqual(hi)
      }
    }
    within(1, 4, 19, 24)
    within(5, 8, 22, 27)
    within(9, 12, 25, 30)
    within(13, 16, 27, 32)
    within(17, 20, 28, 35)
  })
})

describe('gym programme', () => {
  it('only references exercises that exist in the library', () => {
    for (const w of weeks) {
      for (const x of w.workouts.filter((s) => s.type === 'gym')) {
        for (const e of x.exercises ?? []) {
          expect(getExercise(e.exerciseId), `${x.id} ${e.exerciseId}`).toBeDefined()
        }
      }
    }
  })

  it('uses 2 working sets per exercise in weeks 1 and 2', () => {
    for (const w of weeks.slice(0, 2)) {
      for (const x of w.workouts.filter((s) => s.type === 'gym')) {
        expect(x.exercises?.every((e) => e.sets === 2)).toBe(true)
      }
    }
  })

  it('keeps main lifts stable within a block', () => {
    for (const block of ['foundation', 'build', 'progress'] as const) {
      const blockWeeks = weeks.filter((w) => w.block === block)
      for (const day of [1, 3, 5]) {
        const mains = new Set(
          blockWeeks.map(
            (w) =>
              w.workouts.find((x) => x.type === 'gym' && x.dayOfWeek === day)?.exercises?.[0]
                .exerciseId,
          ),
        )
        expect(mains.size, `${block} day ${day}`).toBe(1)
      }
    }
  })

  it('reduces volume on cutback weeks but keeps at least 2 sets', () => {
    const normal = weeks[4].workouts.find((x) => x.type === 'gym' && x.dayOfWeek === 1)!
    const cut = weeks[7].workouts.find((x) => x.type === 'gym' && x.dayOfWeek === 1)!
    const totalSets = (s: typeof normal) => s.exercises!.reduce((n, e) => n + e.sets, 0)
    expect(totalSets(cut)).toBeLessThan(totalSets(normal))
    expect(cut.exercises!.every((e) => e.sets >= 2)).toBe(true)
  })
})
