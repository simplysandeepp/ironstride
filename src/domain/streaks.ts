import { daysBetween, getWeekDays, type DateKey } from './dates.ts'
import type { PlannedSession } from './planner.ts'

/** A saved, completed session. `plannedWorkoutId` is set when it fulfils a planned one. */
export type CompletedSession = { date: DateKey; plannedWorkoutId?: string }

export type StreakResult = { current: number; best: number }

/**
 * A planned session is done when a completed session names it, or when a
 * completed session without a plan link was logged on its date. A session
 * done on a different day (rescheduled) must name the planned one.
 */
export function isPlannedSessionDone(
  planned: PlannedSession,
  completed: readonly CompletedSession[],
): boolean {
  return completed.some(
    (c) => c.plannedWorkoutId === planned.id || (!c.plannedWorkoutId && c.date === planned.date),
  )
}

/**
 * Streaks count consecutive PLANNED sessions that were completed, so planned
 * rest days never break one and nobody has to train every calendar day.
 * - A missed planned session before `today` ends the streak.
 * - A planned session today that is not done yet is still pending: it neither
 *   extends nor breaks the streak.
 * - Future sessions are ignored.
 */
export function calculateStreak(
  planned: readonly PlannedSession[],
  completed: readonly CompletedSession[],
  today: DateKey,
): StreakResult {
  const due = planned
    .filter((p) => daysBetween(p.date, today) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ date: p.date, done: isPlannedSessionDone(p, completed) }))
    .filter((p) => p.done || p.date !== today)

  let best = 0
  let run = 0
  for (const p of due) {
    run = p.done ? run + 1 : 0
    best = Math.max(best, run)
  }

  let current = 0
  for (let i = due.length - 1; i >= 0 && due[i].done; i--) current++
  return { current, best }
}

export const calculateGymStreak = calculateStreak
export const calculateRunStreak = calculateStreak

/** Longest run of consecutive `true` outcomes (e.g. planned sessions in order). */
export function calculateBestStreak(outcomes: readonly boolean[]): number {
  let best = 0
  let run = 0
  for (const done of outcomes) {
    run = done ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export type WeeklyTargetProgress = { planned: number; completed: number; remaining: number }

/** Planned versus completed sessions for the week containing `anyDayInWeek`. */
export function getWeeklyTargetProgress(
  planned: readonly PlannedSession[],
  completed: readonly CompletedSession[],
  anyDayInWeek: DateKey,
): WeeklyTargetProgress {
  const days = new Set(getWeekDays(anyDayInWeek))
  const thisWeek = planned.filter((p) => days.has(p.date))
  const done = thisWeek.filter((p) => isPlannedSessionDone(p, completed)).length
  return { planned: thisWeek.length, completed: done, remaining: thisWeek.length - done }
}
