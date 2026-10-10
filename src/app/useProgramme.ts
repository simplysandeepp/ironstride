import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_PROGRAMME } from '../data/trainingProgramme.ts'
import { db } from '../db/database.ts'
import { repositories } from '../db/repositories.ts'
import { applyOverrides, scaleProgrammeToBaseline } from '../domain/planner.ts'
import type { Programme } from '../domain/programme.ts'
import type { PlannedWorkoutOverride, UserProfile } from '../domain/types.ts'

export type ProgrammeData = {
  profile: UserProfile
  /** The plan in use: scaled to the user's base, with their edits applied. */
  programme: Programme
  /** The scaled plan before the user's edits, to show what a reset returns to. */
  basePlan: Programme
  overrides: PlannedWorkoutOverride[]
}

/**
 * The user's effective programme: the default plan scaled to their running base,
 * with their saved edits on top. `undefined` while loading, `null` before setup.
 */
export function useProgramme(): ProgrammeData | null | undefined {
  return useLiveQuery(async () => {
    const profile = await repositories.profile.get()
    if (!profile) return null
    const overrides = await db.plannedOverrides.toArray()
    const scaled = scaleProgrammeToBaseline(
      DEFAULT_PROGRAMME,
      profile.weeklyRunBaselineKm,
      profile.recentLongRunKm,
    )
    return { profile, programme: applyOverrides(scaled, overrides), basePlan: scaled, overrides }
  })
}
