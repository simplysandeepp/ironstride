import { db } from '../../db/database.ts'
import type { ProgrammeWorkout } from '../../domain/programme.ts'

export const MIN_RUN_KM = 0.5
export const MAX_RUN_KM = 60

export type DistanceResult = { ok: true; km: number } | { ok: false; error: string }

/** Accepts "5", "5.5" or "5,5"; rounds to 0.1 km. */
export function parseDistance(text: string): DistanceResult {
  const km = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(km))
    return { ok: false, error: 'Enter a distance in km, like 5 or 7.5.' }
  if (km < MIN_RUN_KM || km > MAX_RUN_KM) {
    return { ok: false, error: `Distance should be between ${MIN_RUN_KM} and ${MAX_RUN_KM} km.` }
  }
  return { ok: true, km: Math.round(km * 10) / 10 }
}

/** Saves a personal edit on top of the default plan. The default plan itself never changes. */
export async function saveDistanceOverride(workout: ProgrammeWorkout, km: number) {
  const existing = await db.plannedOverrides.get(workout.id)
  await db.plannedOverrides.put({
    ...existing,
    id: workout.id,
    weekNumber: workout.weekNumber,
    dayOfWeek: workout.dayOfWeek,
    plannedDistanceKm: km,
  })
}

export const clearOverride = (id: string) => db.plannedOverrides.delete(id)
