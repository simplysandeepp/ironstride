import { getExercise } from '../../data/exerciseLibrary.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { ProgrammeWorkout } from '../../domain/programme.ts'
import type { GymExerciseLog, GymSession, GymSetLog } from '../../domain/types.ts'

type IdFactory = () => string

/** A fresh in-progress session with the planned sets laid out and empty. */
export function createSessionFromWorkout(
  workout: ProgrammeWorkout,
  date: DateKey,
  nowIso: string,
  newId: IdFactory,
): GymSession {
  const exercises: GymExerciseLog[] = (workout.exercises ?? []).map((planned) => ({
    exerciseId: planned.exerciseId,
    exerciseNameSnapshot: getExercise(planned.exerciseId)?.name ?? planned.exerciseId,
    sets: Array.from({ length: planned.sets }, (_, i) => ({
      id: newId(),
      setNumber: i + 1,
      completed: false,
    })),
  }))
  return {
    id: newId(),
    date,
    plannedWorkoutId: workout.id,
    title: workout.title,
    status: 'in-progress',
    startedAt: nowIso,
    exercises,
  }
}

/** Immutable update of one set. */
export function updateSet(
  session: GymSession,
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<Pick<GymSetLog, 'loadKg' | 'reps' | 'completed' | 'rpe' | 'notes'>>,
): GymSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise, i) =>
      i !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
          },
    ),
  }
}

export function addSet(session: GymSession, exerciseIndex: number, newId: IdFactory): GymSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise, i) =>
      i !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            sets: [
              ...exercise.sets,
              { id: newId(), setNumber: exercise.sets.length + 1, completed: false },
            ],
          },
    ),
  }
}

export function completedSetCount(session: GymSession): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
}

export type FinishCheck = { ok: true } | { ok: false; reason: string }

/** A session needs at least one completed set to count as a workout. */
export function canFinish(session: GymSession): FinishCheck {
  return completedSetCount(session) > 0
    ? { ok: true }
    : {
        ok: false,
        reason: 'Mark at least one set as done to finish. Otherwise discard the workout.',
      }
}

export function finishSession(session: GymSession, nowIso: string): GymSession {
  return { ...session, status: 'completed', finishedAt: nowIso }
}

/** Parses a number input; blank or invalid becomes undefined, never NaN or a negative. */
export function parseNumberInput(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
