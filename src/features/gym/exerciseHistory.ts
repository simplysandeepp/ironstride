import type { SetResult } from '../../domain/strengthProgression.ts'
import type { GymSession } from '../../domain/types.ts'

const newestFirst = (a: GymSession, b: GymSession) =>
  b.date.localeCompare(a.date) || (b.startedAt ?? '').localeCompare(a.startedAt ?? '')

/** Completed sets from the most recent finished session that included the exercise. */
export function getPreviousSets(
  sessions: readonly GymSession[],
  exerciseId: string,
  excludeSessionId?: string,
): SetResult[] {
  for (const session of [...sessions].sort(newestFirst)) {
    if (session.status !== 'completed' || session.id === excludeSessionId) continue
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId && !e.skippedReason)
    const sets = (exercise?.sets ?? []).filter((s) => s.completed)
    if (sets.length > 0) {
      return sets.map((s) => ({ loadKg: s.loadKg, reps: s.reps, completed: true }))
    }
  }
  return []
}

/** "40 kg × 10, 9, 8" (grouped by load); bodyweight sets show reps only. */
export function formatSets(sets: readonly SetResult[]): string {
  const groups: { load?: number; reps: number[] }[] = []
  for (const s of sets) {
    if (s.reps === undefined) continue
    const last = groups[groups.length - 1]
    if (last && last.load === s.loadKg) last.reps.push(s.reps)
    else groups.push({ load: s.loadKg, reps: [s.reps] })
  }
  return groups
    .map((g) =>
      g.load === undefined ? `${g.reps.join(', ')} reps` : `${g.load} kg × ${g.reps.join(', ')}`,
    )
    .join(' · ')
}
