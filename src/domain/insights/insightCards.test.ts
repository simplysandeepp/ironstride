import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { addDays } from '../dates.ts'
import type {
  BodyMeasurement,
  FoodEntry,
  GymSession,
  RunLog,
  SupplementLog,
  UserProfile,
} from '../types.ts'
import { buildInsights, type InsightInput } from './insightCards.ts'

const TODAY = '2026-10-31'
let n = 0

const profile: UserProfile = {
  id: 'local-user',
  heightCm: 175,
  currentWeightKg: 66,
  targetWeightMinKg: 72,
  targetWeightMaxKg: 75,
  ageRange: '20-25',
  dietaryPattern: 'vegan',
  weeklyRunBaselineKm: 18,
  recentLongRunKm: 10,
  gymDaysPerWeek: 3,
  runDaysPerWeek: 4,
  gymSessionMinutes: 60,
  trainingStartDate: '2026-10-12',
  createdAt: '',
  updatedAt: '',
}

const empty = (over: Partial<InsightInput> = {}): InsightInput => ({
  today: TODAY,
  profile,
  programme: DEFAULT_PROGRAMME,
  gymSessions: [],
  runLogs: [],
  foodEntries: [],
  bodyMeasurements: [],
  supplementLogs: [],
  waterEntries: [],
  nutritionTargets: [
    { caloriesKcal: 2700, proteinG: 130, carbsG: 388, fatG: 70, effectiveFrom: '2026-10-01' },
  ],
  waterTargetMl: 3000,
  ...over,
})

const run = (date: string, km: number, over: Partial<RunLog> = {}): RunLog => ({
  id: `r${++n}`,
  date,
  type: 'easy',
  actualDistanceKm: km,
  completed: true,
  ...over,
})
const food = (date: string, kcal: number, protein: number): FoodEntry => ({
  id: `f${++n}`,
  date,
  meal: 'lunch',
  name: 'x',
  quantity: 1,
  unit: 'g',
  caloriesKcal: kcal,
  proteinG: protein,
  carbsG: 0,
  fatG: 0,
})
const ids = (input: InsightInput) => buildInsights(input).map((i) => i.id)
const find = (input: InsightInput, id: string) => buildInsights(input).find((i) => i.id === id)

describe('buildInsights with no data', () => {
  it('says nothing rather than inventing something', () => {
    expect(buildInsights(empty())).toEqual([])
  })
})

describe('running insights', () => {
  const history = [
    run('2026-10-03', 10),
    run('2026-10-10', 10),
    run('2026-10-17', 10),
    run('2026-10-24', 10),
  ]

  it('warns about a load spike and calms down about a steady week', () => {
    expect(
      find(empty({ runLogs: [...history, run('2026-10-29', 16)] }), 'load-spike'),
    ).toMatchObject({ tone: 'watch', area: 'run' })
    expect(find(empty({ runLogs: [...history, run('2026-10-29', 10)] }), 'load-steady')?.tone).toBe(
      'good',
    )
    expect(
      find(empty({ runLogs: [...history, run('2026-10-29', 12)] }), 'load-building')?.tone,
    ).toBe('info')
    expect(ids(empty({ runLogs: [...history, run('2026-10-29', 5)] }))).toContain('load-lighter')
  })

  it('flags easy runs that were not easy, and praises ones that were', () => {
    const rated = (rpe: number, d: string) => run(d, 5, { rpe })
    const hard = [
      rated(6, '2026-10-20'),
      rated(7, '2026-10-22'),
      rated(6, '2026-10-25'),
      rated(4, '2026-10-27'),
    ]
    expect(find(empty({ runLogs: hard }), 'easy-not-easy')?.tone).toBe('watch')
    const easy = [
      rated(3, '2026-10-20'),
      rated(4, '2026-10-22'),
      rated(3, '2026-10-25'),
      rated(4, '2026-10-27'),
    ]
    expect(ids(empty({ runLogs: easy }))).toContain('easy-stays-easy')
    expect(ids(empty({ runLogs: easy.slice(0, 2) }))).not.toContain('easy-stays-easy')
  })

  it('notices easy runs feeling harder over two weeks', () => {
    const runs = [
      run('2026-10-06', 5, { rpe: 3 }),
      run('2026-10-10', 5, { rpe: 3 }),
      run('2026-10-21', 5, { rpe: 5 }),
      run('2026-10-28', 5, { rpe: 5 }),
    ]
    expect(find(empty({ runLogs: runs }), 'easy-effort-up')?.detail).toContain('from 3 to 5')
  })

  it('reports an improving easy pace', () => {
    const p = (d: string, sec: number) =>
      run(d, 5, { durationSeconds: 5 * sec, averagePaceSecondsPerKm: sec })
    const runs = [
      p('2026-10-06', 360),
      p('2026-10-10', 360),
      p('2026-10-21', 340),
      p('2026-10-28', 340),
    ]
    expect(find(empty({ runLogs: runs }), 'pace-faster')?.detail).toContain('20 s/km')
  })

  it('does not nag someone who follows a plan that has two quality runs a week', () => {
    // Week 1-3 of the default plan: about 58% of distance is easy by design.
    const plan = [
      run('2026-10-12', 4),
      run('2026-10-13', 4, { type: 'interval' }),
      run('2026-10-15', 4, { type: 'tempo' }),
      run('2026-10-17', 7, { type: 'long' }),
      run('2026-10-19', 4),
      run('2026-10-20', 4, { type: 'interval' }),
      run('2026-10-22', 4.5, { type: 'tempo' }),
      run('2026-10-24', 8, { type: 'long' }),
    ]
    const out = ids(empty({ today: '2026-10-25', runLogs: plan }))
    expect(out).not.toContain('mix-hard')
    expect(out).toContain('mix-good')
  })

  it('reports the mix of easy and hard running', () => {
    const hard = [
      run('2026-10-20', 5, { type: 'interval' }),
      run('2026-10-22', 5, { type: 'tempo' }),
      run('2026-10-25', 5),
    ]
    expect(ids(empty({ runLogs: hard }))).toContain('mix-hard')
    const easy = [
      run('2026-10-20', 20),
      run('2026-10-25', 10, { type: 'long' }),
      run('2026-10-27', 5, { type: 'tempo' }),
    ]
    expect(ids(empty({ runLogs: easy }))).toContain('mix-good')
  })

  it('celebrates a new longest run only when it beats an earlier one', () => {
    const runs = [run('2026-10-05', 8), run('2026-10-12', 9), run('2026-10-29', 11)]
    expect(find(empty({ runLogs: runs }), 'longest-run')?.title).toContain('11 km')
    expect(
      ids(empty({ runLogs: [run('2026-10-29', 11), run('2026-10-30', 5), run('2026-10-31', 4)] })),
    ).not.toContain('longest-run')
  })
})

describe('strength insights', () => {
  const session = (date: string, kg: number, reps: number[]): GymSession => ({
    id: `g${++n}`,
    date,
    title: 'Upper A',
    status: 'completed',
    exercises: [
      {
        exerciseId: 'lat-pulldown',
        exerciseNameSnapshot: 'Lat pulldown',
        sets: reps.map((r, i) => ({
          id: `s${n}${i}`,
          setNumber: i + 1,
          loadKg: kg,
          reps: r,
          completed: true,
        })),
      },
    ],
  })

  it('announces a new best and a lift that is ready for more weight', () => {
    const sessions = [session('2026-10-15', 45, [10, 10]), session('2026-10-29', 50, [12, 12])]
    const out = ids(empty({ gymSessions: sessions }))
    expect(out).toContain('pr-lat-pulldown')
    expect(out).toContain('ready-lat-pulldown')
    expect(find(empty({ gymSessions: sessions }), 'ready-lat-pulldown')?.detail).toContain(
      '52.5 kg',
    )
  })

  it('flags a plateau gently as information', () => {
    const sessions = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map((d) =>
      session(d, 50, [10]),
    )
    expect(find(empty({ gymSessions: sessions }), 'stalled-lat-pulldown')?.tone).toBe('info')
  })
})

describe('fuel insights', () => {
  const week = (kcal: number, protein: number, days = 7) =>
    Array.from({ length: days }, (_, i) => food(addDays(TODAY, -i), kcal, protein))

  it('praises on-target protein and warns when it is short', () => {
    expect(ids(empty({ foodEntries: week(2700, 130) }))).toContain('protein-good')
    expect(find(empty({ foodEntries: week(2700, 60) }), 'protein-low')?.tone).toBe('watch')
  })

  it('asks for more logging instead of drawing conclusions from a few days', () => {
    const out = ids(empty({ foodEntries: week(2000, 60, 2) }))
    expect(out).toContain('log-more')
    expect(out).not.toContain('protein-low')
  })

  it('notices a calorie shortfall against the target', () => {
    expect(ids(empty({ foodEntries: week(2000, 130) }))).toContain('calories-low')
  })

  it('reports creatine consistency from the day tracking began', () => {
    const log = (date: string, status: SupplementLog['status']): SupplementLog => ({
      id: date,
      date,
      supplement: 'creatine',
      amount: 3,
      unit: 'g',
      status,
    })
    const taken = Array.from({ length: 10 }, (_, i) => log(addDays(TODAY, -i), 'taken'))
    expect(ids(empty({ supplementLogs: taken }))).toContain('creatine-good')
    const patchy = [
      log(addDays(TODAY, -9), 'taken'),
      log(addDays(TODAY, -5), 'taken'),
      log(TODAY, 'skipped'),
    ]
    expect(ids(empty({ supplementLogs: patchy }))).toContain('creatine-low')
  })
})

describe('body insights', () => {
  const weeks = (kgs: number[]): BodyMeasurement[] =>
    kgs.map((kg, i) => ({ id: `w${i}`, date: addDays('2026-10-05', i * 7), weightKg: kg }))

  it('reports a gradual gain with an ETA, without calling it all muscle', () => {
    const input = empty({ bodyMeasurements: weeks([66, 66.4, 66.8, 67.2]) })
    expect(find(input, 'weight-gradual')?.detail).toContain('Not all of a gain is muscle')
    expect(ids(input)).toContain('weight-eta')
  })

  it('warns about a fast rise, a flat trend and a falling trend', () => {
    expect(find(empty({ bodyMeasurements: weeks([66, 67, 68, 69]) }), 'weight-fast')?.tone).toBe(
      'watch',
    )
    expect(ids(empty({ bodyMeasurements: weeks([66, 66.02, 66, 66.03]) }))).toContain('weight-flat')
    expect(
      find(empty({ bodyMeasurements: weeks([66, 65.6, 65.2, 64.8]) }), 'weight-down')?.tone,
    ).toBe('watch')
  })

  it('needs three weeks of weights before commenting on a rate', () => {
    expect(ids(empty({ bodyMeasurements: weeks([66, 67]) }))).toEqual([])
  })
})

describe('consistency insights', () => {
  it('praises high adherence and flags low adherence without blame', () => {
    const gym = (date: string, id: string): GymSession => ({
      id: `g-${id}`,
      date,
      title: 'x',
      status: 'completed',
      plannedWorkoutId: id,
      exercises: [],
    })
    const input = empty({
      today: '2026-11-08',
      gymSessions: [
        'w1-d1-gym',
        'w1-d3-gym',
        'w1-d5-gym',
        'w2-d1-gym',
        'w2-d3-gym',
        'w2-d5-gym',
      ].map((id) => gym('2026-10-12', id)),
    })
    const low = find(input, 'adherence-low')
    expect(low?.tone).toBe('watch')
    expect(low?.detail).not.toMatch(/fail|lazy|bad/i)
  })

  it('points out a session type that keeps being missed', () => {
    const everythingButTempo = DEFAULT_PROGRAMME.weeks
      .flatMap((w) => w.workouts)
      .filter((w) => w.type !== 'rest' && w.type !== 'tempo-run')
    const runLogs = everythingButTempo
      .filter((w) => w.type.endsWith('run'))
      .map((w) => run('2026-10-12', 4, { plannedWorkoutId: w.id }))
    const gymSessions = everythingButTempo
      .filter((w) => w.type === 'gym')
      .map((w): GymSession => ({
        id: w.id,
        date: '2026-10-12',
        title: 'x',
        status: 'completed',
        plannedWorkoutId: w.id,
        exercises: [],
      }))
    expect(
      find(empty({ today: '2026-11-09', runLogs, gymSessions }), 'missed-tempo-run')?.title,
    ).toBe('Tempo run keeps slipping')
  })
})

describe('consistency waits for logging to start', () => {
  it('says nothing about missed sessions before anything has been logged', () => {
    const out = ids(empty({ today: '2026-11-20' }))
    expect(out.filter((i) => i.startsWith('adherence') || i.startsWith('missed'))).toEqual([])
  })

  it('does not blame misses from before the first logged session', () => {
    const late = run('2026-11-18', 4, { plannedWorkoutId: 'w5-d2-run' })
    const out = ids(empty({ today: '2026-11-19', runLogs: [late] }))
    expect(out).not.toContain('adherence-low')
  })
})

describe('ordering and tone', () => {
  it('lists things to watch first, then information, then good news', () => {
    const history = [
      run('2026-10-03', 10),
      run('2026-10-10', 10),
      run('2026-10-17', 10),
      run('2026-10-24', 10),
    ]
    const input = empty({
      runLogs: [...history, run('2026-10-29', 16)],
      foodEntries: Array.from({ length: 7 }, (_, i) => food(addDays(TODAY, -i), 2700, 130)),
    })
    const tones = buildInsights(input).map((i) => i.tone)
    const order = { watch: 0, info: 1, good: 2 }
    expect(tones).toEqual([...tones].sort((a, b) => order[a] - order[b]))
    expect(tones[0]).toBe('watch')
  })

  it('gives every insight a unique id, an area and readable text', () => {
    const history = [
      run('2026-10-03', 10),
      run('2026-10-10', 10),
      run('2026-10-17', 10),
      run('2026-10-24', 10),
      run('2026-10-29', 16),
    ]
    const all = buildInsights(
      empty({
        runLogs: history,
        foodEntries: Array.from({ length: 7 }, (_, i) => food(addDays(TODAY, -i), 2000, 60)),
      }),
    )
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length)
    for (const i of all) {
      expect(i.title.length).toBeGreaterThan(5)
      expect(i.detail.length).toBeGreaterThan(20)
      expect(i.detail).not.toMatch(/undefined|NaN|null/)
    }
  })
})
