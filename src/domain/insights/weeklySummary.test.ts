import { describe, expect, it } from 'vitest'
import type { FoodEntry, GymSession, RunLog } from '../types.ts'
import { compareWeeks, getWeekSummary } from './weeklySummary.ts'

const run = (date: string, km: number, completed = true): RunLog => ({
  id: date + km,
  date,
  type: 'easy',
  actualDistanceKm: km,
  completed,
})
const food = (date: string, kcal: number, protein: number): FoodEntry => ({
  id: date + kcal,
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
const gym = (date: string): GymSession => ({
  id: date,
  date,
  title: 'Upper A',
  status: 'completed',
  exercises: [
    {
      exerciseId: 'bench-press',
      exerciseNameSnapshot: 'Bench',
      sets: [{ id: 'a', setNumber: 1, loadKg: 40, reps: 10, completed: true }],
    },
  ],
})

const data = {
  runLogs: [
    run('2026-10-12', 5),
    run('2026-10-15', 7),
    run('2026-10-14', 3, false),
    run('2026-10-20', 10),
  ],
  gymSessions: [gym('2026-10-13'), gym('2026-10-21')],
  foodEntries: [
    food('2026-10-12', 2400, 110),
    food('2026-10-12', 600, 20),
    food('2026-10-14', 2000, 90),
    food('2026-10-20', 2600, 120),
  ],
  bodyMeasurements: [
    { id: 'a', date: '2026-10-12', weightKg: 66 },
    { id: 'b', date: '2026-10-14', weightKg: 66.4 },
  ],
}

describe('getWeekSummary', () => {
  it('summarises one week from saved records only', () => {
    const w = getWeekSummary(data, '2026-10-12')
    expect(w).toMatchObject({
      runKm: 12,
      runs: 2,
      longestRunKm: 7,
      gymSessions: 1,
      gymSets: 1,
      volumeKg: 400,
      daysLogged: 2,
    })
    expect(w.avgKcal).toBe(2500) // (3000 + 2000) / 2 logged days
    expect(w.avgProteinG).toBe(110)
    expect(w.avgWeightKg).toBe(66.2)
  })

  it('returns nulls for food and weight when nothing was logged', () => {
    expect(getWeekSummary(data, '2026-11-02')).toMatchObject({
      runKm: 0,
      runs: 0,
      avgKcal: null,
      avgProteinG: null,
      avgWeightKg: null,
      daysLogged: 0,
    })
  })
})

describe('compareWeeks', () => {
  it('shows the change from the previous week, and no change where either side is missing', () => {
    const rows = compareWeeks(
      getWeekSummary(data, '2026-10-19'),
      getWeekSummary(data, '2026-10-12'),
    )
    const by = Object.fromEntries(rows.map((r) => [r.label, r]))
    expect(by['Running']).toMatchObject({ current: 10, previous: 12, delta: -2 })
    expect(by['Gym sessions']).toMatchObject({ delta: 0 })
    expect(by['Calories per logged day']).toMatchObject({
      current: 2600,
      previous: 2500,
      delta: 100,
    })
    expect(by['Average weight']).toMatchObject({ current: null, delta: null })
  })
})
