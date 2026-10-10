import { describe, expect, it } from 'vitest'
import type { RunLog, RunType } from '../types.ts'
import {
  getEasyEffortTrend,
  getEasyPaceTrend,
  getEffortDiscipline,
  getIntensityMix,
  getLoadRamp,
  getPaceSeries,
  getRunBests,
  getRunTotals,
} from './runInsights.ts'

const TODAY = '2026-10-31'
let n = 0
const run = (date: string, km: number, over: Partial<RunLog> = {}): RunLog => ({
  id: `r${++n}`,
  date,
  type: 'easy',
  actualDistanceKm: km,
  completed: true,
  ...over,
})
/** A run with duration and pace derived from a pace in seconds per km. */
const paced = (date: string, km: number, secPerKm: number, over: Partial<RunLog> = {}) =>
  run(date, km, { durationSeconds: km * secPerKm, averagePaceSecondsPerKm: secPerKm, ...over })

describe('getLoadRamp', () => {
  it('has no verdict without enough history', () => {
    expect(getLoadRamp([], TODAY)).toEqual({
      acuteKm: 0,
      chronicKm: 0,
      ratio: null,
      zone: 'unknown',
    })
    expect(getLoadRamp([run('2026-10-30', 5), run('2026-10-20', 5)], TODAY).zone).toBe('unknown')
  })

  const history = [
    run('2026-10-03', 10),
    run('2026-10-10', 10),
    run('2026-10-17', 10),
    run('2026-10-24', 10),
  ] // 40 km in the prior 4 weeks

  it('reads steady when this week matches the recent average', () => {
    const r = getLoadRamp([...history, run('2026-10-29', 10)], TODAY)
    expect(r).toMatchObject({ acuteKm: 10, chronicKm: 10, ratio: 1, zone: 'steady' })
  })

  it('reads building and spike as the jump grows', () => {
    expect(getLoadRamp([...history, run('2026-10-29', 12)], TODAY).zone).toBe('building') // 1.2
    expect(getLoadRamp([...history, run('2026-10-29', 16)], TODAY).zone).toBe('spike') // 1.6
  })

  it('reads lighter in a cutback or quiet week', () => {
    expect(getLoadRamp([...history, run('2026-10-29', 5)], TODAY).zone).toBe('lighter')
    expect(getLoadRamp(history, TODAY)).toMatchObject({ acuteKm: 0, zone: 'lighter' })
  })

  it('ignores incomplete runs and runs outside the windows', () => {
    const r = getLoadRamp(
      [...history, run('2026-10-29', 10, { completed: false }), run('2026-09-01', 100)],
      TODAY,
    )
    expect(r.acuteKm).toBe(0)
    expect(r.chronicKm).toBe(10)
  })
})

describe('getRunTotals and getRunBests', () => {
  const runs = [
    run('2026-10-05', 5),
    run('2026-10-12', 12),
    run('2026-10-13', 4),
    run('2026-10-28', 6),
  ]

  it('totals distance, runs and the last 28 days', () => {
    expect(getRunTotals(runs, TODAY)).toEqual({
      runCount: 4,
      totalKm: 27,
      last28Km: 27,
      longestKm: 12,
    })
    expect(getRunTotals([], TODAY)).toEqual({ runCount: 0, totalKm: 0, last28Km: 0, longestKm: 0 })
  })

  it('finds the longest run and the best week', () => {
    const b = getRunBests(runs)
    expect(b.longest).toEqual({ km: 12, date: '2026-10-12' })
    expect(b.bestWeek).toEqual({ weekStart: '2026-10-12', km: 16 })
  })

  it('only counts pace bests over 3 km or more', () => {
    const b = getRunBests([
      paced('2026-10-01', 1, 240),
      paced('2026-10-02', 5, 330),
      paced('2026-10-03', 4, 345),
    ])
    expect(b.fastestPace).toEqual({ secPerKm: 330, km: 5, date: '2026-10-02' })
    expect(getRunBests([run('2026-10-01', 5)]).fastestPace).toBeNull()
    expect(getRunBests([])).toEqual({ longest: null, bestWeek: null, fastestPace: null })
  })
})

describe('pace', () => {
  it('lists paced runs in date order, optionally for given types', () => {
    const series = getPaceSeries([
      paced('2026-10-05', 5, 330),
      paced('2026-10-02', 4, 340, { type: 'tempo' }),
      run('2026-10-03', 5),
    ])
    expect(series.map((p) => p.date)).toEqual(['2026-10-02', '2026-10-05'])
    expect(
      getPaceSeries(
        [paced('2026-10-05', 5, 330), paced('2026-10-02', 4, 340, { type: 'tempo' })],
        ['easy'],
      ).map((p) => p.type),
    ).toEqual(['easy'])
  })

  it('compares easy pace over two 14-day windows, weighted by distance', () => {
    const t = getEasyPaceTrend(
      [
        paced('2026-10-06', 5, 360),
        paced('2026-10-10', 5, 360),
        paced('2026-10-20', 5, 345),
        paced('2026-10-28', 5, 345),
      ],
      TODAY,
    )
    expect(t).toMatchObject({
      recentSecPerKm: 345,
      previousSecPerKm: 360,
      deltaSec: -15,
      direction: 'faster',
    })
  })

  it('calls small changes "about the same" and big slowdowns "slower"', () => {
    const same = getEasyPaceTrend(
      [
        paced('2026-10-06', 5, 360),
        paced('2026-10-10', 5, 360),
        paced('2026-10-20', 5, 357),
        paced('2026-10-28', 5, 357),
      ],
      TODAY,
    )
    expect(same?.direction).toBe('about the same')
    const slower = getEasyPaceTrend(
      [
        paced('2026-10-06', 5, 340),
        paced('2026-10-10', 5, 340),
        paced('2026-10-20', 5, 370),
        paced('2026-10-28', 5, 370),
      ],
      TODAY,
    )
    expect(slower?.direction).toBe('slower')
  })

  it('needs two runs in each window, and ignores hard sessions and very short runs', () => {
    expect(
      getEasyPaceTrend(
        [paced('2026-10-20', 5, 345), paced('2026-10-28', 5, 345), paced('2026-10-10', 5, 360)],
        TODAY,
      ),
    ).toBeNull()
    const hardOnly = getEasyPaceTrend(
      [
        paced('2026-10-06', 5, 300, { type: 'tempo' }),
        paced('2026-10-10', 5, 300, { type: 'tempo' }),
        paced('2026-10-20', 5, 300, { type: 'tempo' }),
        paced('2026-10-28', 5, 300, { type: 'tempo' }),
      ],
      TODAY,
    )
    expect(hardOnly).toBeNull()
    expect(
      getEasyPaceTrend(
        [
          paced('2026-10-06', 1, 300),
          paced('2026-10-10', 1, 300),
          paced('2026-10-20', 1, 300),
          paced('2026-10-28', 1, 300),
        ],
        TODAY,
      ),
    ).toBeNull()
  })
})

describe('effort', () => {
  it('measures how many easy runs stayed conversational, needing at least three rated runs', () => {
    const rated = (rpe: number, d: string) => run(d, 5, { rpe })
    expect(getEffortDiscipline([rated(3, '2026-10-20'), rated(4, '2026-10-22')], TODAY)).toBeNull()
    expect(
      getEffortDiscipline(
        [
          rated(3, '2026-10-20'),
          rated(4, '2026-10-22'),
          rated(6, '2026-10-25'),
          rated(5, '2026-10-27'),
        ],
        TODAY,
      ),
    ).toEqual({ rated: 4, withinEasy: 2, share: 0.5 })
  })

  it('ignores unrated runs, other run types and old runs', () => {
    const runs = [
      run('2026-10-20', 5),
      run('2026-10-21', 5, { type: 'tempo', rpe: 7 }),
      run('2026-08-01', 5, { rpe: 8 }),
    ]
    expect(getEffortDiscipline(runs, TODAY)).toBeNull()
  })

  it('tracks a rise in easy-run effort', () => {
    const e = (rpe: number, d: string) => run(d, 5, { rpe })
    expect(
      getEasyEffortTrend(
        [e(3, '2026-10-05'), e(3, '2026-10-10'), e(5, '2026-10-22'), e(5, '2026-10-28')],
        TODAY,
      ),
    ).toEqual({ recent: 5, previous: 3, delta: 2 })
    expect(getEasyEffortTrend([e(3, '2026-10-28')], TODAY)).toBeNull()
  })
})

describe('getIntensityMix', () => {
  const type = (t: RunType, km: number, d = '2026-10-20') => run(d, km, { type: t })

  it('splits kilometres into easy and hard', () => {
    const mix = getIntensityMix(
      [type('easy', 20), type('long', 10), type('interval', 5), type('tempo', 5)],
      TODAY,
    )
    expect(mix).toEqual({ totalKm: 40, easyKm: 30, hardKm: 10, easyShare: 0.75 })
  })

  it('has nothing to say without recent runs', () => {
    expect(getIntensityMix([], TODAY)).toBeNull()
    expect(getIntensityMix([type('easy', 5, '2026-08-01')], TODAY)).toBeNull()
  })
})
