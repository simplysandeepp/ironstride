import { newId, repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { ProgrammeWorkout } from '../../domain/programme.ts'
import type { GymSession } from '../../domain/types.ts'
import { createSessionFromWorkout } from './sessionModel.ts'

/**
 * Resumes the in-progress session for this planned workout, or the one already
 * completed for it, and only creates a new one when neither exists. Repeated
 * taps on Start therefore cannot create duplicates.
 */
export async function startOrResumeSession(
  workout: ProgrammeWorkout,
  date: DateKey,
  now: Date = new Date(),
): Promise<GymSession> {
  const sessions = await repositories.gymSessions.all()
  const existing =
    sessions.find((s) => s.plannedWorkoutId === workout.id && s.status === 'in-progress') ??
    sessions.find((s) => s.plannedWorkoutId === workout.id && s.status === 'completed')
  if (existing) return existing
  return repositories.gymSessions.save(
    createSessionFromWorkout(workout, date, now.toISOString(), newId),
  )
}
