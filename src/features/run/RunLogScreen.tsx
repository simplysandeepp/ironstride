import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { newId, repositories } from '../../db/repositories.ts'
import { getLocalDateKey } from '../../domain/dates.ts'
import { isRunWorkout } from '../../domain/programme.ts'
import { calculateRunPace, formatPace, parseDuration } from '../../domain/running.ts'
import type { RunLog } from '../../domain/types.ts'
import {
  emptyRunForm,
  plannedRunLogId,
  RUN_TYPE_LABELS,
  runToForm,
  runTypeForWorkout,
  toRunLog,
  validateRunForm,
  type RunFormErrors,
  type RunFormValues,
} from './runForm.ts'

type FormProps = {
  initial: RunFormValues
  logId: string
  plannedWorkoutId?: string
  plannedDistanceKm?: number
  title: string
  hint?: string
}

function RunForm({ initial, logId, plannedWorkoutId, plannedDistanceKm, title, hint }: FormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<RunFormErrors>({})
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<RunFormValues>) => setValues({ ...values, ...patch })
  const seconds = parseDuration(values.duration)
  const pace = seconds ? calculateRunPace(Number(values.distanceKm), seconds) : undefined

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const found = validateRunForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    await repositories.runLogs.save(
      toRunLog(values, { id: logId, plannedWorkoutId, plannedDistanceKm }),
    )
    navigate('/run')
  }

  const field = (
    key: keyof RunFormValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        value={values[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <p className="field-error" id={`${key}-error`} role="alert">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>{title}</h2>
      {hint && <p className="helper">{hint}</p>}
      {field('date', 'Date', { type: 'date' })}
      <div className="field">
        <label htmlFor="type">Run type</label>
        <select
          id="type"
          value={values.type}
          onChange={(e) => set({ type: e.target.value as RunFormValues['type'] })}
        >
          {Object.entries(RUN_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {field('distanceKm', 'Distance (km)', { type: 'text', inputMode: 'decimal' })}
      {field('duration', 'Time (optional, e.g. 27:30)', { type: 'text', inputMode: 'text' })}
      {pace !== undefined && <p className="helper">Average pace {formatPace(pace)} /km</p>}
      {field('rpe', 'Effort 1-10 (optional)', { type: 'text', inputMode: 'numeric' })}
      {field('notes', 'Notes (optional)', { type: 'text' })}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Save run
        </button>
        <button type="button" onClick={() => navigate('/run')}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function RunLogScreen({ today = getLocalDateKey() }: { today?: string }) {
  const [params] = useSearchParams()
  const plannedId = params.get('planned') ?? undefined
  const editId = params.get('edit') ?? undefined
  const plan = useProgramme()
  const existing = useLiveQuery(
    async () => ({ run: editId ? await repositories.runLogs.get(editId) : undefined }),
    [editId],
  )

  if (plan === undefined || !existing)
    return <EmptyState title="Loading">Opening the form.</EmptyState>

  if (editId) {
    if (!existing.run)
      return <EmptyState title="Run not found">It may have been deleted.</EmptyState>
    return (
      <RunForm
        key={existing.run.id}
        initial={runToForm(existing.run as RunLog)}
        logId={existing.run.id}
        plannedWorkoutId={existing.run.plannedWorkoutId}
        plannedDistanceKm={existing.run.plannedDistanceKm}
        title="Edit run"
      />
    )
  }

  const workout = plan?.programme.weeks
    .flatMap((w) => w.workouts)
    .find((w) => w.id === plannedId && isRunWorkout(w))

  if (workout) {
    return (
      <RunForm
        key={workout.id}
        initial={emptyRunForm(today, runTypeForWorkout(workout.type), workout.plannedDistanceKm)}
        logId={plannedRunLogId(workout.id)}
        plannedWorkoutId={workout.id}
        plannedDistanceKm={workout.plannedDistanceKm}
        title={`Log: ${workout.title}`}
        hint={workout.notes}
      />
    )
  }

  return <RunForm key="new" initial={emptyRunForm(today)} logId={newId()} title="Log a run" />
}
