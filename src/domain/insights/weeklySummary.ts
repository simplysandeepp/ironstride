import { getWeekDays, type DateKey } from '../dates.ts'
import { calculateDailyNutrition } from '../nutrition.ts'
import type { BodyMeasurement, FoodEntry, GymSession, RunLog } from '../types.ts'
import { getWeeklyVolume } from './strengthInsights.ts'

export type WeekSummary = {
  weekStart: DateKey
  runKm: number
  runs: number
  longestRunKm: number
  gymSessions: number
  gymSets: number
  volumeKg: number
  daysLogged: number
  avgKcal: number | null
  avgProteinG: number | null
  avgWeightKg: number | null
}

type Data = {
  runLogs: readonly RunLog[]
  gymSessions: readonly GymSession[]
  foodEntries: readonly FoodEntry[]
  bodyMeasurements: readonly BodyMeasurement[]
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** One Monday-to-Sunday week, from saved records only. */
export function getWeekSummary(data: Data, weekStart: DateKey): WeekSummary {
  const days = new Set(getWeekDays(weekStart))
  const runs = data.runLogs.filter((r) => r.completed && days.has(r.date))
  const volume = getWeeklyVolume(data.gymSessions, weekStart, 1)[0]
  const perDay = [...days]
    .map((d) => data.foodEntries.filter((e) => e.date === d))
    .filter((entries) => entries.length > 0)
    .map((entries) => calculateDailyNutrition(entries))
  const weights = data.bodyMeasurements.filter(
    (m) => days.has(m.date) && typeof m.weightKg === 'number',
  )
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const kcal = mean(perDay.map((d) => d.caloriesKcal))
  const protein = mean(perDay.map((d) => d.proteinG))
  const weight = mean(weights.map((m) => m.weightKg!))
  return {
    weekStart,
    runKm: round1(runs.reduce((s, r) => s + r.actualDistanceKm, 0)),
    runs: runs.length,
    longestRunKm: runs.reduce((m, r) => Math.max(m, r.actualDistanceKm), 0),
    gymSessions: volume.sessions,
    gymSets: volume.sets,
    volumeKg: volume.volumeKg,
    daysLogged: perDay.length,
    avgKcal: kcal === null ? null : Math.round(kcal),
    avgProteinG: protein === null ? null : round1(protein),
    avgWeightKg: weight === null ? null : Math.round(weight * 100) / 100,
  }
}

export type WeekChange = {
  label: string
  unit: string
  current: number | null
  previous: number | null
  delta: number | null
}

/** This week so far against the previous full week. A missing value on either side gives no change. */
export function compareWeeks(current: WeekSummary, previous: WeekSummary): WeekChange[] {
  const row = (
    label: string,
    unit: string,
    c: number | null,
    p: number | null,
    digits = 1,
  ): WeekChange => ({
    label,
    unit,
    current: c,
    previous: p,
    delta: c === null || p === null ? null : Math.round((c - p) * 10 ** digits) / 10 ** digits,
  })
  return [
    row('Running', 'km', current.runKm, previous.runKm),
    row('Longest run', 'km', current.longestRunKm, previous.longestRunKm),
    row('Gym sessions', '', current.gymSessions, previous.gymSessions, 0),
    row('Training volume', 'kg', current.volumeKg, previous.volumeKg, 0),
    row('Calories per logged day', 'kcal', current.avgKcal, previous.avgKcal, 0),
    row('Protein per logged day', 'g', current.avgProteinG, previous.avgProteinG),
    row('Average weight', 'kg', current.avgWeightKg, previous.avgWeightKg, 2),
  ]
}
