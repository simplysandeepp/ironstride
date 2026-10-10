import { addDays, daysBetween, getDayOfWeek, getWeekStart, type DateKey } from './dates.ts'
import {
  getWeekRunKm,
  isRunWorkout,
  type Programme,
  type ProgrammeWeek,
  type ProgrammeWorkout,
} from './programme.ts'
import type { PlannedWorkoutOverride } from './types.ts'

/** Week 1 may be at most this much above the current weekly base / recent long run. */
const MAX_START_RATIO = 1.1
const KM_STEP = 0.5
const MIN_RUN_KM = 1

const roundToStep = (km: number) => Math.max(MIN_RUN_KM, Math.round(km / KM_STEP) * KM_STEP)

/**
 * The factor (at most 1) that keeps week 1 close to what the user already runs.
 * The programme is never scaled up automatically.
 */
export function getScaleFactor(
  programme: Programme,
  baselineKm: number,
  recentLongRunKm: number,
): number {
  const week1 = programme.weeks[0]
  if (!week1 || !(baselineKm > 0)) return 1
  const week1Total = getWeekRunKm(week1)
  const week1Long = week1.workouts.find((w) => w.type === 'long-run')?.plannedDistanceKm ?? 0
  const byTotal = week1Total > 0 ? (baselineKm * MAX_START_RATIO) / week1Total : 1
  const byLong =
    recentLongRunKm > 0 && week1Long > 0 ? (recentLongRunKm * MAX_START_RATIO) / week1Long : 1
  return Math.min(1, byTotal, byLong)
}

/** Scales every planned run distance down when the user's base is below the template start. */
export function scaleProgrammeToBaseline(
  programme: Programme,
  baselineKm: number,
  recentLongRunKm: number,
): Programme {
  const factor = getScaleFactor(programme, baselineKm, recentLongRunKm)
  if (factor >= 1) return programme
  return {
    weeks: programme.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((workout) =>
        isRunWorkout(workout) && workout.plannedDistanceKm !== undefined
          ? { ...workout, plannedDistanceKm: roundToStep(workout.plannedDistanceKm * factor) }
          : workout,
      ),
    })),
  }
}

/** Layers the user's saved edits (matched by workout id) over the default programme. */
export function applyOverrides(
  programme: Programme,
  overrides: readonly PlannedWorkoutOverride[],
): Programme {
  if (overrides.length === 0) return programme
  const byId = new Map(overrides.map((o) => [o.id, o]))
  return {
    weeks: programme.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((workout) => {
        const o = byId.get(workout.id)
        if (!o) return workout
        return {
          ...workout,
          ...(o.type !== undefined && { type: o.type }),
          ...(o.title !== undefined && { title: o.title }),
          ...(o.notes !== undefined && { notes: o.notes }),
          ...(o.plannedDistanceKm !== undefined && { plannedDistanceKm: o.plannedDistanceKm }),
          ...(o.estimatedMinutes !== undefined && { estimatedMinutes: o.estimatedMinutes }),
        }
      }),
    })),
  }
}

/** Programme week (1-based) containing `date`, or undefined before the start or after the end. */
export function getWeekNumberForDate(
  date: DateKey,
  startDate: DateKey,
  totalWeeks: number,
): number | undefined {
  if (daysBetween(startDate, date) < 0) return undefined
  const weekNumber = Math.floor(daysBetween(getWeekStart(startDate), date) / 7) + 1
  return weekNumber <= totalWeeks ? weekNumber : undefined
}

export function getProgrammeWeekForDate(
  programme: Programme,
  date: DateKey,
  startDate: DateKey,
): ProgrammeWeek | undefined {
  const n = getWeekNumberForDate(date, startDate, programme.weeks.length)
  return n === undefined ? undefined : programme.weeks[n - 1]
}

/**
 * Everything planned for a date. Returns a list because a day can hold a gym
 * session and a run. Empty before the start date or after week 26.
 */
export function getPlannedWorkoutsForDate(
  programme: Programme,
  date: DateKey,
  startDate: DateKey,
): ProgrammeWorkout[] {
  const week = getProgrammeWeekForDate(programme, date, startDate)
  if (!week) return []
  const dow = getDayOfWeek(date)
  return week.workouts.filter((w) => w.dayOfWeek === dow)
}

/** The calendar date a programme workout falls on for the given start date. */
export function getWorkoutDate(workout: ProgrammeWorkout, startDate: DateKey): DateKey {
  const monday = addDays(getWeekStart(startDate), (workout.weekNumber - 1) * 7)
  const offset = (workout.dayOfWeek - 1 + 7) % 7
  return addDays(monday, offset)
}
