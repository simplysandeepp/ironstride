import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { getPlannedSessions } from '../../domain/planner.ts'
import type { GymSession } from '../../domain/types.ts'
import {
  getLoggedExercises,
  getPhaseSummary,
  getStrengthSeries,
  getWeeklySessionCounts,
  plannedKmForWeek,
} from './chartModel.ts'

const START = '2026-10-12'
const gymPlanned = getPlannedSessions(DEFAULT_PROGRAMME, START, 'gym')

describe('getWeeklySessionCounts', () => {
  it('counts planned and completed sessions per week, with zeros before the plan', () => {
    const completed = gymPlanned.slice(0, 2).map((p) => ({ date: p.date, plannedWorkoutId: p.id }))
    const weeks = getWeeklySessionCounts(gymPlanned, completed, '2026-10-20', 3)
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(weeks.map((w) => [w.planned, w.completed])).toEqual([
      [0, 0],
      [3, 2],
      [3, 0],
    ])
  })
})

describe('plannedKmForWeek', () => {
  it('returns the plan total inside the programme and nothing outside it', () => {
    expect(plannedKmForWeek(DEFAULT_PROGRAMME, START, '2026-10-12')).toBe(19)
    expect(plannedKmForWeek(DEFAULT_PROGRAMME, START, '2026-10-05')).toBeUndefined()
    expect(plannedKmForWeek(DEFAULT_PROGRAMME, START, '2027-05-31')).toBeUndefined()
  })

  it('maps a mid-week start to week 1', () => {
    expect(plannedKmForWeek(DEFAULT_PROGRAMME, '2026-10-14', '2026-10-12')).toBe(19)
  })
})

describe('strength series', () => {
  const session = (
    id: string,
    date: string,
    status: GymSession['status'],
    loads: (number | undefined)[],
    skipped = false,
  ): GymSession => ({
    id,
    date,
    title: 'Upper A',
    status,
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseNameSnapshot: 'Barbell bench press',
        ...(skipped && { skippedReason: 'Too tired' }),
        sets: loads.map((l, i) => ({
          id: `${id}${i}`,
          setNumber: i + 1,
          loadKg: l,
          reps: 8,
          completed: l !== undefined,
        })),
      },
    ],
  })

  it('takes the heaviest completed set per finished session, in date order', () => {
    const out = getStrengthSeries(
      [
        session('b', '2026-10-19', 'completed', [42.5, 40]),
        session('a', '2026-10-12', 'completed', [40, 40]),
        session('c', '2026-10-26', 'in-progress', [60]),
      ],
      'bench-press',
    )
    expect(out).toEqual([
      { date: '2026-10-12', value: 40 },
      { date: '2026-10-19', value: 42.5 },
    ])
  })

  it('ignores skipped exercises and sets without loads', () => {
    expect(
      getStrengthSeries([session('a', '2026-10-12', 'completed', [40], true)], 'bench-press'),
    ).toEqual([])
    expect(
      getStrengthSeries([session('a', '2026-10-12', 'completed', [undefined])], 'bench-press'),
    ).toEqual([])
    expect(getLoggedExercises([session('a', '2026-10-12', 'completed', [40])])).toEqual([
      { id: 'bench-press', name: 'Barbell bench press' },
    ])
    expect(getLoggedExercises([])).toEqual([])
  })
})

describe('getPhaseSummary', () => {
  it('describes the block, remaining weeks, next recovery week and long run', () => {
    const p = getPhaseSummary(DEFAULT_PROGRAMME, START, '2026-10-12')!
    expect(p).toMatchObject({
      weekNumber: 1,
      weeksLeftInBlock: 7,
      nextCutbackWeek: 4,
      plannedLongRunKm: 7,
    })
    expect(p.blockName).toMatch(/Foundation/)
  })

  it('is undefined outside the programme', () => {
    expect(getPhaseSummary(DEFAULT_PROGRAMME, START, '2026-10-05')).toBeUndefined()
    expect(getPhaseSummary(DEFAULT_PROGRAMME, START, '2027-06-01')).toBeUndefined()
  })
})
