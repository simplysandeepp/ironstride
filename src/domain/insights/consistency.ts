import { getWorkoutDate, type PlannedSession } from '../planner.ts'
import type { DateKey } from '../dates.ts'
import { addDays } from '../dates.ts'
import { isGymWorkout, isRunWorkout, type Programme } from '../programme.ts'
import { isPlannedSessionDone, type CompletedSession } from '../streaks.ts'

export type AdherenceResult = { due: number; done: number; share: number | null }

/** Below this many due sessions a percentage would mean very little. */
export const MIN_DUE_FOR_SHARE = 3

/**
 * Planned sessions completed over the last `days` days. Today's session is only counted once
 * it is done, so an unfinished day never reads as a miss.
 */
export function getPlanAdherence(
  planned: readonly PlannedSession[],
  completed: readonly CompletedSession[],
  today: DateKey,
  days = 28,
  /** Ignore anything before this date, such as the day the first session was logged. */
  since?: DateKey,
): AdherenceResult {
  const from = since && since > addDays(today, -(days - 1)) ? since : addDays(today, -(days - 1))
  const inWindow = planned.filter((p) => p.date >= from && p.date <= today)
  const done = inWindow.filter((p) => isPlannedSessionDone(p, completed))
  const due = inWindow.filter((p) => p.date < today || isPlannedSessionDone(p, completed)).length
  return {
    due,
    done: done.length,
    share: due >= MIN_DUE_FOR_SHARE ? Math.round((done.length / due) * 100) / 100 : null,
  }
}

export type MissedPattern = { key: string; title: string; missed: number; of: number }

const RUN_TITLES: Record<string, string> = {
  'easy-run': 'Easy run',
  'interval-run': 'Intervals',
  'tempo-run': 'Tempo run',
  'long-run': 'Long run',
}

/**
 * Sessions that keep getting missed: the same kind of session skipped at least twice, and at
 * least half the time, over the last `weeks` weeks. A prompt to adjust the plan, not a score.
 */
export function getMissedPatterns(
  programme: Programme,
  startDate: DateKey,
  completedGym: readonly CompletedSession[],
  completedRuns: readonly CompletedSession[],
  today: DateKey,
  weeks = 6,
  since?: DateKey,
): MissedPattern[] {
  const windowStart = addDays(today, -(weeks * 7 - 1))
  const from = since && since > windowStart ? since : windowStart
  const groups = new Map<string, MissedPattern>()
  for (const workout of programme.weeks.flatMap((w) => w.workouts)) {
    const gym = isGymWorkout(workout)
    if (!gym && !isRunWorkout(workout)) continue
    const date = getWorkoutDate(workout, startDate)
    if (date < from || date >= today) continue // today is still open
    const key = gym ? workout.title : workout.type
    const title = gym ? workout.title : (RUN_TITLES[workout.type] ?? workout.title)
    const entry = groups.get(key) ?? { key, title, missed: 0, of: 0 }
    entry.of += 1
    if (!isPlannedSessionDone({ id: workout.id, date }, gym ? completedGym : completedRuns))
      entry.missed += 1
    groups.set(key, entry)
  }
  return [...groups.values()]
    .filter((g) => g.missed >= 2 && g.missed / g.of >= 0.5)
    .sort((a, b) => b.missed - a.missed)
}
