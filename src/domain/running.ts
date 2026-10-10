import { getWeekDays, type DateKey } from './dates.ts'
import type { RunLog } from './types.ts'

/** Seconds per km, or undefined when distance or duration is missing or not positive. */
export function calculateRunPace(distanceKm: number, durationSeconds: number): number | undefined {
  if (!(distanceKm > 0) || !(durationSeconds > 0)) return undefined
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationSeconds)) return undefined
  return durationSeconds / distanceKm
}

/** "5:30" for 330 seconds per km. */
export function formatPace(secondsPerKm: number | undefined): string {
  if (secondsPerKm === undefined || !Number.isFinite(secondsPerKm)) return '--'
  const total = Math.round(secondsPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "5:30" or "5.5" style input to seconds per km; undefined if it cannot be read. */
export function parsePace(input: string): number | undefined {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(input.trim())
  if (!match) return undefined
  const seconds = Number(match[1]) * 60 + Number(match[2])
  return seconds > 0 ? seconds : undefined
}

/** Completed run kilometres in the week containing `anyDayInWeek`. */
export function calculateWeeklyRunDistance(
  runLogs: readonly RunLog[],
  anyDayInWeek: DateKey,
): number {
  const days = new Set(getWeekDays(anyDayInWeek))
  const total = runLogs
    .filter((r) => r.completed && days.has(r.date))
    .reduce((sum, r) => sum + r.actualDistanceKm, 0)
  return Math.round(total * 100) / 100
}

export function validateRunLog(
  run: Partial<RunLog>,
): Partial<Record<'distance' | 'duration' | 'rpe', string>> {
  const errors: Partial<Record<'distance' | 'duration' | 'rpe', string>> = {}
  if (!(typeof run.actualDistanceKm === 'number' && run.actualDistanceKm > 0))
    errors.distance = 'Distance must be greater than 0.'
  if (run.durationSeconds !== undefined && !(run.durationSeconds > 0))
    errors.duration = 'Duration must be greater than 0.'
  if (run.rpe !== undefined && !(run.rpe >= 1 && run.rpe <= 10))
    errors.rpe = 'Effort is a number from 1 to 10.'
  return errors
}
