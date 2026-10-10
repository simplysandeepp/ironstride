import { getExercise } from '../../data/exerciseLibrary.ts'
import { addDays, getWeekStart, type DateKey } from '../dates.ts'
import { getProgressionSuggestion } from '../strengthProgression.ts'
import type { GymSession } from '../types.ts'

const finished = (sessions: readonly GymSession[]) =>
  sessions.filter((s) => s.status === 'completed')
const round1 = (n: number) => Math.round(n * 10) / 10

/** A completed set that carries a load and reps; bodyweight sets have no load and are skipped. */
type LoadedSet = { exerciseId: string; name: string; date: DateKey; loadKg: number; reps: number }

function loadedSets(sessions: readonly GymSession[]): LoadedSet[] {
  return finished(sessions).flatMap((s) =>
    s.exercises
      .filter((e) => !e.skippedReason)
      .flatMap((e) =>
        e.sets
          .filter(
            (x) =>
              x.completed &&
              typeof x.loadKg === 'number' &&
              x.loadKg > 0 &&
              typeof x.reps === 'number' &&
              x.reps > 0,
          )
          .map((x) => ({
            exerciseId: e.exerciseId,
            name: e.exerciseNameSnapshot,
            date: s.date,
            loadKg: x.loadKg!,
            reps: x.reps!,
          })),
      ),
  )
}

// ───────── Estimated strength ─────────

/** Estimates are only trusted up to this many reps; beyond it the formula drifts. */
export const MAX_REPS_FOR_ESTIMATE = 12

/** Epley estimate of the heaviest single you could lift: load × (1 + reps ÷ 30). A guide, not a test. */
export function estimateOneRepMax(loadKg: number, reps: number): number | null {
  if (
    !(loadKg > 0) ||
    !Number.isFinite(loadKg) ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > MAX_REPS_FOR_ESTIMATE
  )
    return null
  return round1(reps === 1 ? loadKg : loadKg * (1 + reps / 30))
}

export type ExercisePR = {
  exerciseId: string
  name: string
  estimatedOneRepMax: number
  loadKg: number
  reps: number
  date: DateKey
  sessions: number
}

/** The best estimated single per exercise, with the set it came from. */
export function getExercisePRs(sessions: readonly GymSession[]): ExercisePR[] {
  const best = new Map<string, ExercisePR>()
  const sessionDates = new Map<string, Set<DateKey>>()
  for (const s of loadedSets(sessions)) {
    sessionDates.set(s.exerciseId, (sessionDates.get(s.exerciseId) ?? new Set()).add(s.date))
    const est = estimateOneRepMax(s.loadKg, s.reps)
    if (est === null) continue
    const current = best.get(s.exerciseId)
    if (!current || est > current.estimatedOneRepMax) {
      best.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        name: s.name,
        estimatedOneRepMax: est,
        loadKg: s.loadKg,
        reps: s.reps,
        date: s.date,
        sessions: 0,
      })
    }
  }
  return [...best.values()]
    .map((pr) => ({ ...pr, sessions: sessionDates.get(pr.exerciseId)?.size ?? 0 }))
    .sort((a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax)
}

export type StrengthPoint = { date: DateKey; estimatedOneRepMax: number }

/** Best estimated single in each finished session, oldest first. */
export function getStrengthTrend(
  sessions: readonly GymSession[],
  exerciseId: string,
): StrengthPoint[] {
  const perDate = new Map<DateKey, number>()
  for (const s of loadedSets(sessions).filter((x) => x.exerciseId === exerciseId)) {
    const est = estimateOneRepMax(s.loadKg, s.reps)
    if (est !== null) perDate.set(s.date, Math.max(perDate.get(s.date) ?? 0, est))
  }
  return [...perDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, estimatedOneRepMax]) => ({ date, estimatedOneRepMax }))
}

/** Lifts whose all-time best was set in the last `days` days, and beat everything before it. */
export function getRecentPRs(
  sessions: readonly GymSession[],
  today: DateKey,
  days = 7,
): ExercisePR[] {
  const from = addDays(today, -(days - 1))
  return getExercisePRs(sessions).filter((pr) => {
    if (pr.date < from || pr.date > today) return false
    // A first-ever session is not a "new" record yet: there is nothing it beat.
    return getStrengthTrend(sessions, pr.exerciseId).some((p) => p.date < pr.date)
  })
}

export const STALL_MIN_SESSIONS = 4
export const STALL_WINDOW = 3

/**
 * Lifts with at least 4 sessions where the last 3 did not beat the best of the sessions before them.
 * A prompt to check sleep, food and technique, or to try a small variation, not a failure.
 */
export function getStalledLifts(
  sessions: readonly GymSession[],
): { exerciseId: string; name: string; sessions: number; bestOneRepMax: number }[] {
  const names = new Map(loadedSets(sessions).map((s) => [s.exerciseId, s.name]))
  const out = []
  for (const [exerciseId, name] of names) {
    const trend = getStrengthTrend(sessions, exerciseId)
    if (trend.length < STALL_MIN_SESSIONS) continue
    const earlierBest = Math.max(...trend.slice(0, -STALL_WINDOW).map((p) => p.estimatedOneRepMax))
    const recentBest = Math.max(...trend.slice(-STALL_WINDOW).map((p) => p.estimatedOneRepMax))
    if (recentBest <= earlierBest)
      out.push({ exerciseId, name, sessions: trend.length, bestOneRepMax: earlierBest })
  }
  return out
}

export type ReadyLift = { exerciseId: string; name: string; loadKg: number; nextLoadKg: number }

/** Lifts where every working set in your latest session reached the top of the rep range. */
export function getReadyToProgress(
  sessions: readonly GymSession[],
  today: DateKey,
  withinDays = 14,
): ReadyLift[] {
  const from = addDays(today, -(withinDays - 1))
  const latest = new Map<
    string,
    { date: DateKey; sets: { loadKg?: number; reps?: number; completed: boolean }[]; name: string }
  >()
  for (const s of finished(sessions)
    .filter((x) => x.date >= from && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises.filter((x) => !x.skippedReason))
      latest.set(e.exerciseId, { date: s.date, sets: e.sets, name: e.exerciseNameSnapshot })
  }
  const out: ReadyLift[] = []
  for (const [exerciseId, { sets, name }] of latest) {
    const range = getExercise(exerciseId)?.repRange
    if (!range) continue
    const suggestion = getProgressionSuggestion([], sets, range)
    if (suggestion.action === 'increase' && suggestion.nextLoadKg) {
      out.push({
        exerciseId,
        name,
        loadKg: suggestion.nextLoadKg - 2.5,
        nextLoadKg: suggestion.nextLoadKg,
      })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

// ───────── Volume ─────────

export type MuscleGroup =
  'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core'

const GROUP_OF: Record<string, MuscleGroup> = {
  chest: 'Chest',
  'upper chest': 'Chest',
  lats: 'Back',
  'mid back': 'Back',
  'upper back': 'Back',
  'lower back': 'Back',
  'front delts': 'Shoulders',
  'side delts': 'Shoulders',
  'rear delts': 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Core',
  core: 'Core',
}

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
]

/** Each completed set counts fully for its main (first listed) muscle group and half for other primary groups. */
export const INDIRECT_CREDIT = 0.5

export function setsByGroup(session: GymSession): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  for (const e of session.exercises.filter((x) => !x.skippedReason)) {
    const muscles = getExercise(e.exerciseId)?.primaryMuscles ?? []
    const groups = muscles.map((m) => GROUP_OF[m]).filter((g): g is MuscleGroup => Boolean(g))
    const done = e.sets.filter((x) => x.completed).length
    if (done === 0 || groups.length === 0) continue
    const main = groups[0]
    out.set(main, (out.get(main) ?? 0) + done)
    for (const g of new Set(groups.slice(1)))
      if (g !== main) out.set(g, (out.get(g) ?? 0) + done * INDIRECT_CREDIT)
  }
  return out
}

export type MuscleVolume = { group: MuscleGroup; last7Days: number; weeklyAverage: number }

/** Hard sets per muscle group: the last 7 days, and the average week over the last 28 days. */
export function getMuscleVolume(sessions: readonly GymSession[], today: DateKey): MuscleVolume[] {
  const week = new Map<MuscleGroup, number>()
  const month = new Map<MuscleGroup, number>()
  for (const s of finished(sessions)) {
    if (s.date > today) continue
    const inMonth = s.date >= addDays(today, -27)
    const inWeek = s.date >= addDays(today, -6)
    if (!inMonth) continue
    for (const [g, n] of setsByGroup(s)) {
      month.set(g, (month.get(g) ?? 0) + n)
      if (inWeek) week.set(g, (week.get(g) ?? 0) + n)
    }
  }
  return MUSCLE_GROUPS.map((group) => ({
    group,
    last7Days: round1(week.get(group) ?? 0),
    weeklyAverage: round1((month.get(group) ?? 0) / 4),
  }))
}

export type WeeklyVolume = { weekStart: DateKey; volumeKg: number; sets: number; sessions: number }

/** Total load lifted (kg × reps), completed sets and sessions for each of the last `weeks` weeks, oldest first. */
export function getWeeklyVolume(
  sessions: readonly GymSession[],
  endDate: DateKey,
  weeks = 8,
): WeeklyVolume[] {
  const lastStart = getWeekStart(endDate)
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(lastStart, -7 * (weeks - 1 - i))
    const weekEnd = addDays(weekStart, 6)
    const inWeek = finished(sessions).filter((s) => s.date >= weekStart && s.date <= weekEnd)
    const sets = inWeek.flatMap((s) =>
      s.exercises.filter((e) => !e.skippedReason).flatMap((e) => e.sets.filter((x) => x.completed)),
    )
    return {
      weekStart,
      sessions: inWeek.length,
      sets: sets.length,
      volumeKg: Math.round(sets.reduce((sum, x) => sum + (x.loadKg ?? 0) * (x.reps ?? 0), 0)),
    }
  })
}

export type SessionStats = {
  sessionsLast28Days: number
  perWeek: number
  averageMinutes: number | null
}

const MAX_SESSION_MINUTES = 240

export function getSessionStats(sessions: readonly GymSession[], today: DateKey): SessionStats {
  const recent = finished(sessions).filter((s) => s.date >= addDays(today, -27) && s.date <= today)
  const minutes = recent
    .filter((s) => s.startedAt && s.finishedAt)
    .map((s) => (new Date(s.finishedAt!).getTime() - new Date(s.startedAt!).getTime()) / 60_000)
    .filter((m) => m > 0 && m <= MAX_SESSION_MINUTES)
  return {
    sessionsLast28Days: recent.length,
    perWeek: round1(recent.length / 4),
    averageMinutes: minutes.length
      ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
      : null,
  }
}
