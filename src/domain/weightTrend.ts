import { addDays, getWeekStart, type DateKey } from './dates.ts'
import type { BodyMeasurement } from './types.ts'

export type WeightPoint = { date: DateKey; weightKg: number; rollingAvgKg?: number }

const WINDOW_DAYS = 7
const MIN_ENTRIES_IN_WINDOW = 3
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Actual entries in date order, each with a 7-day rolling average when at least
 * 3 entries fall in the window. Nothing is interpolated between entries.
 */
export function getWeightTrend(measurements: readonly BodyMeasurement[]): WeightPoint[] {
  const points = measurements
    .filter((m): m is BodyMeasurement & { weightKg: number } => typeof m.weightKg === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
  return points.map((p) => {
    const from = addDays(p.date, -(WINDOW_DAYS - 1))
    const window = points.filter((q) => q.date >= from && q.date <= p.date)
    return {
      date: p.date,
      weightKg: p.weightKg,
      ...(window.length >= MIN_ENTRIES_IN_WINDOW && {
        rollingAvgKg: round2(window.reduce((s, q) => s + q.weightKg, 0) / window.length),
      }),
    }
  })
}

export type WeeklyAverage = { weekStart: DateKey; avgKg: number; entries: number }

export function getWeeklyAverages(measurements: readonly BodyMeasurement[]): WeeklyAverage[] {
  const byWeek = new Map<DateKey, number[]>()
  for (const m of measurements) {
    if (typeof m.weightKg !== 'number') continue
    const key = getWeekStart(m.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), m.weightKg])
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, values]) => ({
      weekStart,
      avgKg: round2(values.reduce((s, v) => s + v, 0) / values.length),
      entries: values.length,
    }))
}

export type CalorieSuggestion = {
  deltaKcal: number
  reason: string
}

const RAPID_GAIN_KG_PER_WEEK = 0.5
const FLAT_TOLERANCE_KG = 0.1

/**
 * A suggestion only; the app never changes targets by itself. Needs at least 3
 * weekly averages (2-3 weeks of data) and never shames a flat or noisy week.
 */
export function suggestCalorieAdjustment(
  weekly: readonly WeeklyAverage[],
  options: { targetMaxKg: number; waistRising?: boolean },
): CalorieSuggestion | null {
  if (weekly.length < 3) return null
  const last = weekly[weekly.length - 1]
  const earlier = weekly[weekly.length - 3]
  const change = last.avgKg - earlier.avgKg
  const perWeek = change / 2

  if (change <= FLAT_TOLERANCE_KG && last.avgKg < options.targetMaxKg) {
    return {
      deltaKcal: 150,
      reason:
        'Your weekly average has not risen over the last 2 weeks. Consider adding about 150-200 kcal a day.',
    }
  }
  if (perWeek > RAPID_GAIN_KG_PER_WEEK && options.waistRising) {
    return {
      deltaKcal: -150,
      reason:
        'Weight and waist are both rising quickly. Consider reviewing portions or reducing about 150-200 kcal a day.',
    }
  }
  return null
}
