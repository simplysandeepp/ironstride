export type SetResult = { loadKg?: number; reps?: number; completed: boolean }

export type ProgressionSuggestion = {
  action: 'increase' | 'keep' | 'reduce'
  nextLoadKg?: number
  reason: string
}

const DEFAULT_INCREMENT_KG = 2.5
const SHARP_DROP_RATIO = 0.7

const worked = (sets: readonly SetResult[]) =>
  sets.filter((s) => s.completed && typeof s.reps === 'number' && typeof s.loadKg === 'number')

/**
 * Double progression. Keep the load while reps climb inside the range; when
 * every working set reaches the top of the range, suggest a small increase.
 * It is only a suggestion; the user decides.
 */
export function getProgressionSuggestion(
  previousSets: readonly SetResult[],
  currentSets: readonly SetResult[],
  repRange: readonly [number, number],
  incrementKg = DEFAULT_INCREMENT_KG,
): ProgressionSuggestion {
  const current = worked(currentSets)
  if (current.length === 0) {
    return { action: 'keep', reason: 'Log your working sets to see a suggestion.' }
  }
  const [minReps, maxReps] = repRange
  const load = Math.max(...current.map((s) => s.loadKg!))
  const allAtTop = current.every((s) => s.reps! >= maxReps)

  if (allAtTop) {
    return {
      action: 'increase',
      nextLoadKg: load + incrementKg,
      reason: `Every set reached ${maxReps} reps. If form was good, try ${load + incrementKg} kg next time.`,
    }
  }

  const previous = worked(previousSets)
  if (previous.length > 0) {
    const avg = (sets: typeof current) => sets.reduce((s, x) => s + x.reps!, 0) / sets.length
    if (avg(current) < avg(previous) * SHARP_DROP_RATIO) {
      return {
        action: 'reduce',
        nextLoadKg: Math.max(0, load - incrementKg),
        reason: 'Reps dropped sharply. Consider a slightly lighter load or more rest.',
      }
    }
  }

  const belowMin = current.some((s) => s.reps! < minReps)
  return {
    action: 'keep',
    nextLoadKg: load,
    reason: belowMin
      ? `Aim for at least ${minReps} reps per set at this load before going up.`
      : `Keep ${load} kg and add reps until every set reaches ${maxReps}.`,
  }
}
