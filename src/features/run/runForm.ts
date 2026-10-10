import { isDateKey, type DateKey } from '../../domain/dates.ts'
import type { PlannedWorkoutType, RunLog, RunType } from '../../domain/types.ts'
import { calculateRunPace, formatDuration, parseDuration } from '../../domain/running.ts'

export type RunFormValues = {
  date: string
  type: RunType
  distanceKm: string
  duration: string
  rpe: string
  notes: string
}

export type RunFormErrors = Partial<Record<keyof RunFormValues, string>>

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  easy: 'Easy',
  interval: 'Intervals',
  tempo: 'Tempo',
  long: 'Long run',
  recovery: 'Recovery',
  other: 'Other',
}

const PLANNED_TO_RUN_TYPE: Partial<Record<PlannedWorkoutType, RunType>> = {
  'easy-run': 'easy',
  'interval-run': 'interval',
  'tempo-run': 'tempo',
  'long-run': 'long',
}

export const runTypeForWorkout = (type: PlannedWorkoutType): RunType =>
  PLANNED_TO_RUN_TYPE[type] ?? 'other'

export function emptyRunForm(
  date: DateKey,
  type: RunType = 'easy',
  plannedKm?: number,
): RunFormValues {
  return {
    date,
    type,
    distanceKm: plannedKm !== undefined ? String(plannedKm) : '',
    duration: '',
    rpe: '',
    notes: '',
  }
}

export function runToForm(run: RunLog): RunFormValues {
  return {
    date: run.date,
    type: run.type,
    distanceKm: String(run.actualDistanceKm),
    duration: formatDuration(run.durationSeconds),
    rpe: run.rpe === undefined ? '' : String(run.rpe),
    notes: run.notes ?? '',
  }
}

export function validateRunForm(values: RunFormValues): RunFormErrors {
  const errors: RunFormErrors = {}
  if (!isDateKey(values.date)) errors.date = 'Pick a valid date.'
  const km = Number(values.distanceKm)
  if (values.distanceKm.trim() === '' || !Number.isFinite(km) || km <= 0 || km > 250) {
    errors.distanceKm = 'Distance must be greater than 0 and at most 250 km.'
  }
  if (values.duration.trim() !== '' && parseDuration(values.duration) === undefined) {
    errors.duration = 'Use minutes (45), mm:ss (45:30) or h:mm:ss (1:05:30).'
  }
  if (values.rpe.trim() !== '') {
    const rpe = Number(values.rpe)
    if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)
      errors.rpe = 'Effort is a whole number from 1 to 10.'
  }
  return errors
}

type BuildOptions = {
  id: string
  plannedWorkoutId?: string
  plannedDistanceKm?: number
}

/** Builds the saved record; call only after validateRunForm returns no errors. */
export function toRunLog(values: RunFormValues, options: BuildOptions): RunLog {
  const distance = Number(values.distanceKm)
  const duration = parseDuration(values.duration)
  return {
    id: options.id,
    date: values.date,
    plannedWorkoutId: options.plannedWorkoutId,
    type: values.type,
    plannedDistanceKm: options.plannedDistanceKm,
    actualDistanceKm: distance,
    durationSeconds: duration,
    averagePaceSecondsPerKm:
      duration === undefined ? undefined : calculateRunPace(distance, duration),
    rpe: values.rpe.trim() === '' ? undefined : Number(values.rpe),
    notes: values.notes.trim() === '' ? undefined : values.notes.trim(),
    completed: true,
  }
}

/** One log per planned run, so a double tap overwrites instead of duplicating. */
export const plannedRunLogId = (plannedWorkoutId: string) => `run-${plannedWorkoutId}`
