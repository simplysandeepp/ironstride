import { getDayOfWeek, getLastNDays, type DateKey, type WeekStart } from './dates.ts'
import type { GymSession, RunLog } from './types.ts'

export type HeatmapFilter = 'all' | 'gym' | 'run'
export type Intensity = 0 | 1 | 2 | 3 | 4

export type DayActivities = { gym: GymSession[]; runs: RunLog[] }

/**
 * Intensity = points for each COMPLETED activity on the day, capped at 4.
 *   run: under 3 km = 1, 3 to under 10 km = 2, 10 km or more = 3
 *   gym: under 6 completed sets = 1, 6 to under 15 = 2, 15 or more = 3
 * Only saved, completed records count. Opening a workout scores nothing.
 */
export const RUN_LONG_KM = 10
export const RUN_SHORT_KM = 3
export const GYM_BIG_SETS = 15
export const GYM_SMALL_SETS = 6

export function completedSetCount(session: GymSession): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
}

export function runPoints(run: RunLog): number {
  if (!run.completed || !(run.actualDistanceKm > 0)) return 0
  if (run.actualDistanceKm >= RUN_LONG_KM) return 3
  return run.actualDistanceKm >= RUN_SHORT_KM ? 2 : 1
}

export function gymPoints(session: GymSession): number {
  if (session.status !== 'completed') return 0
  const sets = completedSetCount(session)
  if (sets >= GYM_BIG_SETS) return 3
  return sets >= GYM_SMALL_SETS ? 2 : 1
}

/** Groups saved records by date, keeping only completed activities. */
export function groupActivitiesByDate(
  gymSessions: readonly GymSession[],
  runLogs: readonly RunLog[],
): Map<DateKey, DayActivities> {
  const map = new Map<DateKey, DayActivities>()
  const slot = (date: DateKey) => {
    let entry = map.get(date)
    if (!entry) map.set(date, (entry = { gym: [], runs: [] }))
    return entry
  }
  for (const s of gymSessions) if (s.status === 'completed') slot(s.date).gym.push(s)
  for (const r of runLogs) if (r.completed) slot(r.date).runs.push(r)
  return map
}

export function getHeatmapIntensity(
  activities: DayActivities | undefined,
  filter: HeatmapFilter = 'all',
): Intensity {
  if (!activities) return 0
  const gym = filter === 'run' ? 0 : activities.gym.reduce((n, s) => n + gymPoints(s), 0)
  const run = filter === 'gym' ? 0 : activities.runs.reduce((n, r) => n + runPoints(r), 0)
  return Math.min(4, gym + run) as Intensity
}

export type HeatmapCell = {
  date: DateKey
  intensity: Intensity
  gymCount: number
  runCount: number
}

/** "Tuesday, 2026-10-13: 1 run, no gym" style text for screen readers. */
export function describeHeatmapCell(cell: HeatmapCell): string {
  const count = (n: number, noun: string) => (n === 0 ? `no ${noun}` : `${n} ${noun}`)
  return `${cell.date}: ${count(cell.runCount, 'run')}, ${count(cell.gymCount, 'gym')}`
}

export function buildHeatmap(
  endDate: DateKey,
  activitiesByDate: ReadonlyMap<DateKey, DayActivities>,
  filter: HeatmapFilter = 'all',
  days = 365,
): HeatmapCell[] {
  return getLastNDays(endDate, days).map((date) => {
    const a = activitiesByDate.get(date)
    return {
      date,
      intensity: getHeatmapIntensity(a, filter),
      gymCount: a?.gym.length ?? 0,
      runCount: a?.runs.length ?? 0,
    }
  })
}

/**
 * Lays cells out in week columns (7 rows each) like a contribution graph.
 * Slots before the first and after the last date are null padding.
 */
export function toWeekColumns(
  cells: readonly HeatmapCell[],
  weekStartsOn: WeekStart = 1,
): (HeatmapCell | null)[][] {
  if (cells.length === 0) return []
  const leading = (getDayOfWeek(cells[0].date) - weekStartsOn + 7) % 7
  const slots: (HeatmapCell | null)[] = [...Array(leading).fill(null), ...cells]
  while (slots.length % 7 !== 0) slots.push(null)
  const columns: (HeatmapCell | null)[][] = []
  for (let i = 0; i < slots.length; i += 7) columns.push(slots.slice(i, i + 7))
  return columns
}
