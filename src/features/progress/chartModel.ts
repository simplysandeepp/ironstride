import { addDays, getWeekDays, getWeekStart, type DateKey } from '../../domain/dates.ts'
import { getProgrammeWeekForDate } from '../../domain/planner.ts'
import { getWeekRunKm, type Programme } from '../../domain/programme.ts'
import type { GymSession } from '../../domain/types.ts'
import type { PlannedSession } from '../../domain/planner.ts'
import { isPlannedSessionDone, type CompletedSession } from '../../domain/streaks.ts'

export type WeekCount = { weekStart: DateKey; planned: number; completed: number }

/** Planned versus completed planned sessions for each of the last `weeks` weeks, oldest first. */
export function getWeeklySessionCounts(
  planned: readonly PlannedSession[],
  completed: readonly CompletedSession[],
  endDate: DateKey,
  weeks = 8,
): WeekCount[] {
  const lastStart = getWeekStart(endDate)
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(lastStart, -7 * (weeks - 1 - i))
    const days = new Set(getWeekDays(weekStart))
    const inWeek = planned.filter((p) => days.has(p.date))
    return {
      weekStart,
      planned: inWeek.length,
      completed: inWeek.filter((p) => isPlannedSessionDone(p, completed)).length,
    }
  })
}

/** Planned kilometres for the programme week containing `weekStart`, or undefined outside the plan. */
export function plannedKmForWeek(
  programme: Programme,
  startDate: DateKey,
  weekStart: DateKey,
): number | undefined {
  // Use the later of the week start and the plan start so mid-week starts still map to week 1.
  const date = weekStart < startDate ? startDate : weekStart
  if (getWeekStart(date) !== weekStart && weekStart < getWeekStart(startDate)) return undefined
  const week = getProgrammeWeekForDate(programme, date, startDate)
  return week ? getWeekRunKm(week) : undefined
}

export type LoadPoint = { date: DateKey; value: number }

/** Heaviest completed set per finished session, oldest first, for one exercise. */
export function getStrengthSeries(
  sessions: readonly GymSession[],
  exerciseId: string,
): LoadPoint[] {
  return sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => {
      const loads = s.exercises
        .filter((e) => e.exerciseId === exerciseId && !e.skippedReason)
        .flatMap((e) =>
          e.sets.filter((x) => x.completed && typeof x.loadKg === 'number').map((x) => x.loadKg!),
        )
      return loads.length > 0 ? [{ date: s.date, value: Math.max(...loads) }] : []
    })
}

/** Exercises that have at least one logged load, for the exercise picker. */
export function getLoggedExercises(
  sessions: readonly GymSession[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    for (const e of s.exercises) {
      if (!e.skippedReason && e.sets.some((x) => x.completed && typeof x.loadKg === 'number')) {
        seen.set(e.exerciseId, e.exerciseNameSnapshot)
      }
    }
  }
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export type PhaseSummary = {
  weekNumber: number
  blockName: string
  focus: string
  weeksLeftInBlock: number
  nextCutbackWeek?: number
  plannedLongRunKm?: number
}

export function getPhaseSummary(
  programme: Programme,
  startDate: DateKey,
  today: DateKey,
): PhaseSummary | undefined {
  const week = getProgrammeWeekForDate(programme, today, startDate)
  if (!week) return undefined
  const sameBlock = programme.weeks.filter(
    (w) => w.block === week.block && w.weekNumber >= week.weekNumber,
  )
  return {
    weekNumber: week.weekNumber,
    blockName: week.blockName,
    focus: week.focus,
    weeksLeftInBlock: sameBlock.length - 1,
    nextCutbackWeek: programme.weeks.find((w) => w.isCutback && w.weekNumber > week.weekNumber)
      ?.weekNumber,
    plannedLongRunKm: week.workouts.find((w) => w.type === 'long-run')?.plannedDistanceKm,
  }
}
