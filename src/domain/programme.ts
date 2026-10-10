import type { PlannedWorkoutType } from './types.ts'

/** 0 = Sunday ... 6 = Saturday (matches Date#getDay). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type BlockId = 'foundation' | 'build' | 'progress' | 'consolidate'

export type PlannedExercise = {
  exerciseId: string
  sets: number
  repRange: [number, number]
}

/** A workout in the default programme. Completion is derived from logs, never stored here. */
export type ProgrammeWorkout = {
  id: string
  weekNumber: number
  dayOfWeek: DayOfWeek
  type: PlannedWorkoutType
  title: string
  notes?: string
  plannedDistanceKm?: number
  estimatedMinutes?: number
  /** Gym sessions only. */
  exercises?: PlannedExercise[]
}

export type ProgrammeWeek = {
  weekNumber: number
  block: BlockId
  blockName: string
  focus: string
  isCutback: boolean
  notes: string
  workouts: ProgrammeWorkout[]
}

export type Programme = {
  weeks: ProgrammeWeek[]
}

export const RUN_TYPES: readonly PlannedWorkoutType[] = [
  'easy-run',
  'interval-run',
  'tempo-run',
  'long-run',
]

export function isRunWorkout(workout: Pick<ProgrammeWorkout, 'type'>): boolean {
  return RUN_TYPES.includes(workout.type)
}

export function isGymWorkout(workout: Pick<ProgrammeWorkout, 'type'>): boolean {
  return workout.type === 'gym'
}

/** Weekly running distance, always computed from the individual runs. */
export function getWeekRunKm(week: ProgrammeWeek): number {
  const total = week.workouts
    .filter(isRunWorkout)
    .reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0)
  return Math.round(total * 100) / 100
}

export function getWeekGymSessions(week: ProgrammeWeek): number {
  return week.workouts.filter(isGymWorkout).length
}

export function getWeekRunSessions(week: ProgrammeWeek): number {
  return week.workouts.filter(isRunWorkout).length
}
