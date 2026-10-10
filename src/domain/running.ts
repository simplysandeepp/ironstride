import { addDays, getWeekDays, getWeekStart, type DateKey } from './dates.ts'
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

/** "45" (minutes), "45:30" (mm:ss) or "1:05:30" (h:mm:ss) to seconds; undefined if unreadable. */
export function parseDuration(input: string): number | undefined {
  const text = input.trim()
  if (text === '') return undefined
  if (/^\d+(\.\d+)?$/.test(text)) {
    const minutes = Number(text)
    return minutes > 0 ? Math.round(minutes * 60) : undefined
  }
  const parts = text.split(':')
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d{1,2}$/.test(p)))
    return undefined
  const nums = parts.map(Number)
  if (nums.slice(1).some((n) => n > 59)) return undefined
  const seconds =
    nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1]
  return seconds > 0 ? seconds : undefined
}

/** 3930 -> "1:05:30"; 1650 -> "27:30". */
export function formatDuration(totalSeconds: number | undefined): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) return ''
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

const LOAD_WARNING_RATIO = 1.25

/**
 * A gentle heads-up when a planned week is well above what the user has been
 * running: the larger of their configured base and their best recent week.
 */
export function getLoadWarning(
  plannedWeekKm: number,
  baselineKm: number,
  recentWeeklyKm: readonly number[] = [],
): string | undefined {
  const reference = Math.max(baselineKm, ...recentWeeklyKm)
  if (!(reference > 0) || plannedWeekKm <= reference * LOAD_WARNING_RATIO) return undefined
  return `This week plans ${plannedWeekKm} km, well above your recent ${reference} km. Shorten runs or swap quality work for easy running if you feel tired, and update your weekly base in Settings if it is out of date.`
}

export type WeeklyRunSummary = { weekStart: DateKey; km: number; longestRunKm: number }

/** The last `weeks` Monday-start weeks ending with the week containing `endDate`, oldest first. */
export function getWeeklyRunSummaries(
  runLogs: readonly RunLog[],
  endDate: DateKey,
  weeks = 8,
): WeeklyRunSummary[] {
  const lastStart = getWeekStart(endDate)
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(lastStart, -7 * (weeks - 1 - i))
    const days = new Set(getWeekDays(weekStart))
    const inWeek = runLogs.filter((r) => r.completed && days.has(r.date))
    return {
      weekStart,
      km: Math.round(inWeek.reduce((s, r) => s + r.actualDistanceKm, 0) * 100) / 100,
      longestRunKm: inWeek.reduce((max, r) => Math.max(max, r.actualDistanceKm), 0),
    }
  })
}
