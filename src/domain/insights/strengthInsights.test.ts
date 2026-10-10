import { describe, expect, it } from 'vitest'
import type { GymSession } from '../types.ts'
import {
  estimateOneRepMax,
  getExercisePRs,
  getMuscleVolume,
  getReadyToProgress,
  getRecentPRs,
  getSessionStats,
  getStalledLifts,
  getStrengthTrend,
  getWeeklyVolume,
  setsByGroup,
} from './strengthInsights.ts'

let n = 0
type SetSpec = [number | undefined, number, boolean?] // load, reps, completed
const session = (
  date: string,
  exercises: Record<string, SetSpec[]>,
  over: Partial<GymSession> = {},
): GymSession => ({
  id: `s${++n}`,
  date,
  title: 'Upper A',
  status: 'completed',
  exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({
    exerciseId,
    exerciseNameSnapshot: exerciseId,
    sets: sets.map(([loadKg, reps, done = true], i) => ({
      id: `${n}-${exerciseId}-${i}`,
      setNumber: i + 1,
      loadKg,
      reps,
      completed: done,
    })),
  })),
  ...over,
})
const TODAY = '2026-10-31'

describe('estimateOneRepMax', () => {
  it('applies Epley and returns the load itself for a single', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(80, 8)).toBe(101.3)
    expect(estimateOneRepMax(60, 10)).toBe(80)
  })

  it('refuses invalid or unreliable inputs', () => {
    for (const [w, r] of [
      [0, 5],
      [-10, 5],
      [50, 0],
      [50, 13],
      [50, 2.5],
      [Number.NaN, 5],
    ] as const) {
      expect(estimateOneRepMax(w, r), `${w}x${r}`).toBeNull()
    }
  })
})

describe('PRs and trends', () => {
  const sessions = [
    session('2026-10-05', {
      'bench-press': [
        [40, 8],
        [40, 8],
      ],
    }),
    session('2026-10-12', {
      'bench-press': [
        [42.5, 8],
        [42.5, 7],
      ],
    }),
    session('2026-10-29', { 'bench-press': [[45, 8]], 'lat-pulldown': [[50, 10]] }),
  ]

  it('finds the best estimated single per exercise with its source set', () => {
    const prs = getExercisePRs(sessions)
    const bench = prs.find((p) => p.exerciseId === 'bench-press')!
    expect(bench).toMatchObject({ loadKg: 45, reps: 8, date: '2026-10-29', sessions: 3 })
    expect(bench.estimatedOneRepMax).toBe(57)
    expect(prs[0].estimatedOneRepMax).toBeGreaterThanOrEqual(prs[1].estimatedOneRepMax)
  })

  it('builds a per-session trend, oldest first, one best value per day', () => {
    expect(getStrengthTrend(sessions, 'bench-press').map((p) => p.date)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-29',
    ])
    expect(getStrengthTrend(sessions, 'nope')).toEqual([])
  })

  it('flags a recent PR only when it beat an earlier session', () => {
    expect(getRecentPRs(sessions, TODAY).map((p) => p.exerciseId)).toEqual(['bench-press'])
    expect(getRecentPRs(sessions, '2026-11-20')).toEqual([])
  })

  it('ignores skipped, incomplete and bodyweight sets', () => {
    const odd = session('2026-10-20', {
      'bench-press': [
        [100, 5, false],
        [undefined, 10],
      ],
      plank: [[undefined, 30]],
    })
    expect(getExercisePRs([odd])).toEqual([])
    const skipped = session('2026-10-21', { 'bench-press': [[100, 5]] })
    skipped.exercises[0].skippedReason = 'Too tired'
    expect(getExercisePRs([skipped])).toEqual([])
    expect(
      getExercisePRs([
        session('2026-10-22', { 'bench-press': [[100, 5]] }, { status: 'in-progress' }),
      ]),
    ).toEqual([])
  })
})

describe('getStalledLifts', () => {
  const lift = (date: string, kg: number) => session(date, { 'bench-press': [[kg, 8]] })

  it('flags a lift whose last three sessions did not beat what came before', () => {
    const stalled = getStalledLifts([
      lift('2026-10-01', 50),
      lift('2026-10-08', 50),
      lift('2026-10-15', 50),
      lift('2026-10-22', 47.5),
    ])
    expect(stalled.map((s) => s.exerciseId)).toEqual(['bench-press'])
  })

  it('stays quiet while a lift is still improving or has too few sessions', () => {
    expect(
      getStalledLifts([
        lift('2026-10-01', 40),
        lift('2026-10-08', 42.5),
        lift('2026-10-15', 45),
        lift('2026-10-22', 47.5),
      ]),
    ).toEqual([])
    expect(
      getStalledLifts([lift('2026-10-01', 50), lift('2026-10-08', 50), lift('2026-10-15', 50)]),
    ).toEqual([])
  })
})

describe('getReadyToProgress', () => {
  it('lists lifts where every set reached the top of the range', () => {
    const ready = getReadyToProgress(
      [
        session('2026-10-29', {
          'lat-pulldown': [
            [50, 12],
            [50, 12],
          ],
          'bench-press': [
            [40, 10],
            [40, 8],
          ],
        }),
      ],
      TODAY,
    )
    expect(ready).toEqual([
      { exerciseId: 'lat-pulldown', name: 'lat-pulldown', loadKg: 50, nextLoadKg: 52.5 },
    ])
  })

  it('looks only at the latest session and ignores old ones', () => {
    const sessions = [
      session('2026-10-20', {
        'lat-pulldown': [
          [50, 12],
          [50, 12],
        ],
      }),
      session('2026-10-29', {
        'lat-pulldown': [
          [52.5, 9],
          [52.5, 8],
        ],
      }),
    ]
    expect(getReadyToProgress(sessions, TODAY)).toEqual([])
    expect(
      getReadyToProgress([session('2026-08-01', { 'lat-pulldown': [[50, 12]] })], TODAY),
    ).toEqual([])
  })
})

describe('muscle volume', () => {
  it('credits the main muscle fully and other primary muscles by half', () => {
    const groups = setsByGroup(
      session('2026-10-29', {
        'bench-press': [
          [40, 8],
          [40, 8],
          [40, 8],
        ],
      }),
    )
    expect(groups.get('Chest')).toBe(3)
    expect(groups.get('Arms')).toBe(1.5)
    expect(groups.get('Shoulders')).toBe(1.5)
  })

  it('counts only completed sets of exercises that were not skipped', () => {
    const s = session('2026-10-29', {
      'bench-press': [
        [40, 8],
        [40, 8, false],
      ],
    })
    expect(setsByGroup(s).get('Chest')).toBe(1)
    s.exercises[0].skippedReason = 'x'
    expect(setsByGroup(s).size).toBe(0)
  })

  it('reports the last 7 days and the 4-week average per group', () => {
    const sessions = [
      session('2026-10-29', {
        'calf-raise': [[0, 1]],
        'leg-press': [
          [100, 10],
          [100, 10],
        ],
      }),
      session('2026-10-10', {
        'leg-press': [
          [100, 10],
          [100, 10],
        ],
      }),
    ]
    const quads = getMuscleVolume(sessions, TODAY).find((g) => g.group === 'Quads')!
    expect(quads).toMatchObject({ last7Days: 2, weeklyAverage: 1 })
    expect(getMuscleVolume([], TODAY)).toHaveLength(9)
  })
})

describe('volume and session stats', () => {
  it('totals kg × reps, sets and sessions per week, oldest first', () => {
    const w = getWeeklyVolume(
      [
        session('2026-10-27', {
          'bench-press': [
            [40, 10],
            [40, 8],
          ],
        }),
        session('2026-10-29', { 'lat-pulldown': [[50, 10]] }),
        session('2026-10-20', { 'bench-press': [[40, 10]] }),
      ],
      TODAY,
      2,
    )
    expect(w.map((x) => x.weekStart)).toEqual(['2026-10-19', '2026-10-26'])
    expect(w[0]).toMatchObject({ sessions: 1, sets: 1, volumeKg: 400 })
    expect(w[1]).toMatchObject({ sessions: 2, sets: 3, volumeKg: 1220 })
  })

  it('computes sessions per week and average duration, ignoring impossible durations', () => {
    const timed = (date: string, mins: number) =>
      session(
        date,
        { 'bench-press': [[40, 8]] },
        {
          startedAt: `${date}T07:00:00Z`,
          finishedAt: new Date(
            new Date(`${date}T07:00:00Z`).getTime() + mins * 60_000,
          ).toISOString(),
        },
      )
    const stats = getSessionStats(
      [
        timed('2026-10-12', 50),
        timed('2026-10-14', 70),
        timed('2026-10-16', 900),
        session('2026-10-18', { 'bench-press': [[40, 8]] }),
      ],
      TODAY,
    )
    expect(stats).toEqual({ sessionsLast28Days: 4, perWeek: 1, averageMinutes: 60 })
    expect(getSessionStats([], TODAY)).toEqual({
      sessionsLast28Days: 0,
      perWeek: 0,
      averageMinutes: null,
    })
  })
})
