import { describe, expect, it } from 'vitest'
import {
  buildHeatmap,
  describeHeatmapCell,
  getHeatmapIntensity,
  groupActivitiesByDate,
  toWeekColumns,
} from './heatmap.ts'
import type { GymSession, RunLog } from './types.ts'

const run = (over: Partial<RunLog> = {}): RunLog => ({
  id: 'r1',
  date: '2026-10-10',
  type: 'easy',
  actualDistanceKm: 5,
  completed: true,
  ...over,
})

const gym = (sets: number, over: Partial<GymSession> = {}): GymSession => ({
  id: 'g1',
  date: '2026-10-10',
  title: 'Upper A',
  status: 'completed',
  exercises: [
    {
      exerciseId: 'bench-press',
      exerciseNameSnapshot: 'Bench press',
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `s${i}`,
        setNumber: i + 1,
        completed: true,
      })),
    },
  ],
  ...over,
})

describe('intensity', () => {
  it('is 0 for empty days', () => {
    expect(getHeatmapIntensity(undefined)).toBe(0)
    expect(getHeatmapIntensity({ gym: [], runs: [] })).toBe(0)
  })

  it('scores runs by distance', () => {
    const at = (km: number) =>
      getHeatmapIntensity({ gym: [], runs: [run({ actualDistanceKm: km })] })
    expect(at(2)).toBe(1)
    expect(at(5)).toBe(2)
    expect(at(12)).toBe(3)
  })

  it('scores gym by completed sets', () => {
    const at = (n: number) => getHeatmapIntensity({ gym: [gym(n)], runs: [] })
    expect(at(3)).toBe(1)
    expect(at(10)).toBe(2)
    expect(at(18)).toBe(3)
  })

  it('combines a gym session and a run, capped at 4', () => {
    const day = { gym: [gym(18)], runs: [run({ actualDistanceKm: 12 })] }
    expect(getHeatmapIntensity(day, 'all')).toBe(4)
    expect(getHeatmapIntensity(day, 'gym')).toBe(3)
    expect(getHeatmapIntensity(day, 'run')).toBe(3)
  })

  it('does not count a gym session as a run or a run as gym', () => {
    expect(getHeatmapIntensity({ gym: [gym(10)], runs: [] }, 'run')).toBe(0)
    expect(getHeatmapIntensity({ gym: [], runs: [run()] }, 'gym')).toBe(0)
  })
})

describe('groupActivitiesByDate', () => {
  it('keeps only completed activity', () => {
    const map = groupActivitiesByDate(
      [
        gym(10),
        gym(10, { id: 'g2', status: 'in-progress' }),
        gym(10, { id: 'g3', status: 'skipped' }),
      ],
      [run(), run({ id: 'r2', completed: false })],
    )
    expect(map.get('2026-10-10')?.gym).toHaveLength(1)
    expect(map.get('2026-10-10')?.runs).toHaveLength(1)
  })

  it('updates when a log is edited or deleted', () => {
    const before = groupActivitiesByDate([], [run({ actualDistanceKm: 5 })])
    expect(buildHeatmap('2026-10-10', before, 'all', 1)[0].intensity).toBe(2)
    const edited = groupActivitiesByDate([], [run({ actualDistanceKm: 2 })])
    expect(buildHeatmap('2026-10-10', edited, 'all', 1)[0].intensity).toBe(1)
    const deleted = groupActivitiesByDate([], [])
    expect(buildHeatmap('2026-10-10', deleted, 'all', 1)[0].intensity).toBe(0)
  })
})

describe('buildHeatmap', () => {
  const empty = groupActivitiesByDate([], [])

  it('covers exactly 365 days ending on the end date, with no fake activity', () => {
    const cells = buildHeatmap('2026-10-10', empty)
    expect(cells).toHaveLength(365)
    expect(cells[364].date).toBe('2026-10-10')
    expect(cells[0].date).toBe('2025-10-11')
    expect(cells.every((c) => c.intensity === 0 && c.gymCount === 0 && c.runCount === 0)).toBe(true)
  })

  it('handles leap years and year boundaries', () => {
    const cells = buildHeatmap('2024-12-31', empty)
    expect(cells[0].date).toBe('2024-01-02')
    expect(cells.some((c) => c.date === '2024-02-29')).toBe(true)
    const next = buildHeatmap('2025-01-05', empty)
    expect(next.some((c) => c.date === '2024-12-31')).toBe(true)
  })

  it('reflects both gym and run on the same day for the matching filters', () => {
    const map = groupActivitiesByDate([gym(10)], [run()])
    const all = buildHeatmap('2026-10-10', map, 'all', 1)[0]
    const gymOnly = buildHeatmap('2026-10-10', map, 'gym', 1)[0]
    const runOnly = buildHeatmap('2026-10-10', map, 'run', 1)[0]
    expect([all.intensity, gymOnly.intensity, runOnly.intensity]).toEqual([4, 2, 2])
    expect(all.gymCount).toBe(1)
    expect(all.runCount).toBe(1)
  })
})

describe('toWeekColumns and labels', () => {
  it('pads to full Monday-start weeks', () => {
    const cells = buildHeatmap('2026-10-10', groupActivitiesByDate([], []), 'all', 10)
    const columns = toWeekColumns(cells)
    expect(columns.every((c) => c.length === 7)).toBe(true)
    expect(columns.flat().filter(Boolean)).toHaveLength(10)
    expect(columns[0][0]).toBeNull()
  })

  it('describes a cell for screen readers', () => {
    expect(
      describeHeatmapCell({ date: '2026-10-13', intensity: 2, gymCount: 0, runCount: 1 }),
    ).toBe('2026-10-13: 1 run, no gym')
  })
})
