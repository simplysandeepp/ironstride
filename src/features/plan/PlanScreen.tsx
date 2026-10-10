import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { getExercise } from '../../data/exerciseLibrary.ts'
import {
  addDays,
  formatDayMonth,
  getLocalDateKey,
  getWeekStart,
  type DateKey,
} from '../../domain/dates.ts'
import { getScaleFactor, getWeekNumberForDate } from '../../domain/planner.ts'
import {
  getWeekRunKm,
  isGymWorkout,
  isRunWorkout,
  type ProgrammeWeek,
  type ProgrammeWorkout,
} from '../../domain/programme.ts'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { clearOverride, parseDistance, saveDistanceOverride } from './planEdit.ts'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function RunEditor({
  workout,
  defaultKm,
  edited,
}: {
  workout: ProgrammeWorkout
  defaultKm?: number
  edited: boolean
}) {
  const [text, setText] = useState(String(workout.plannedDistanceKm ?? ''))
  const [error, setError] = useState<string>()

  async function save() {
    const result = parseDistance(text)
    if (!result.ok) return setError(result.error)
    setError(undefined)
    await saveDistanceOverride(workout, result.km)
  }

  const id = `km-${workout.id}`
  return (
    <div className="plan-edit">
      <div className="field">
        <label htmlFor={id}>Distance for {workout.title} (km)</label>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p className="field-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="button" onClick={() => void save()}>
          Save distance
        </button>
        {edited && (
          <button
            type="button"
            onClick={() => {
              setText(String(defaultKm ?? ''))
              void clearOverride(workout.id)
            }}
          >
            Reset to {defaultKm} km
          </button>
        )}
      </div>
    </div>
  )
}

function WeekCard({
  week,
  startDate,
  isCurrent,
  base,
  editedIds,
}: {
  week: ProgrammeWeek
  startDate: DateKey
  isCurrent: boolean
  base: Map<string, number | undefined>
  editedIds: Set<string>
}) {
  const monday = addDays(getWeekStart(startDate), (week.weekNumber - 1) * 7)
  const gymCount = week.workouts.filter(isGymWorkout).length
  const runCount = week.workouts.filter(isRunWorkout).length
  const edited = week.workouts.some((w) => editedIds.has(w.id))

  return (
    <details className={`card week${isCurrent ? ' week-current' : ''}`} open={isCurrent}>
      <summary>
        <strong>Week {week.weekNumber}</strong> · from {formatDayMonth(monday)} ·{' '}
        <strong>{getWeekRunKm(week)} km</strong>
        {week.isCutback ? ' · Recovery week' : ''}
        {isCurrent ? ' · This week' : ''}
        {edited ? ' · Edited' : ''}
        <span className="helper week-sub">
          {week.blockName} · {gymCount} gym · {runCount} runs
        </span>
      </summary>
      <p className="helper">{week.notes}</p>
      <ul className="task-list">
        {DAY_ORDER.flatMap((dow) => week.workouts.filter((w) => w.dayOfWeek === dow)).map((w) => (
          <li key={w.id} className="plan-day">
            <div className="plan-row">
              <span className="helper">{DAY_NAMES[w.dayOfWeek]}</span>
              <strong>{w.title}</strong>
              {w.plannedDistanceKm !== undefined && (
                <span className="metric-inline"> {w.plannedDistanceKm} km</span>
              )}
            </div>
            {w.exercises && (
              <p className="helper">
                {w.exercises
                  .map(
                    (e) =>
                      `${getExercise(e.exerciseId)?.name ?? e.exerciseId} ${e.sets}×${e.repRange[0]}-${e.repRange[1]}`,
                  )
                  .join(' · ')}
              </p>
            )}
            {isRunWorkout(w) && (
              <RunEditor workout={w} defaultKm={base.get(w.id)} edited={editedIds.has(w.id)} />
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function PlanScreen({ today = getLocalDateKey() }: { today?: DateKey }) {
  const plan = useProgramme()
  if (plan === undefined) return <EmptyState title="Loading">Reading your plan.</EmptyState>
  if (plan === null)
    return <EmptyState title="Set up your plan">Add your details in Settings first.</EmptyState>

  const { programme, basePlan, overrides, profile } = plan
  const start = profile.trainingStartDate
  const currentWeek = getWeekNumberForDate(today, start, programme.weeks.length)
  const base = new Map(
    basePlan.weeks.flatMap((w) => w.workouts).map((w) => [w.id, w.plannedDistanceKm]),
  )
  const editedIds = new Set(overrides.map((o) => o.id))
  const factor = getScaleFactor(
    DEFAULT_PROGRAMME,
    profile.weeklyRunBaselineKm,
    profile.recentLongRunKm,
  )
  const peak = Math.max(...programme.weeks.map(getWeekRunKm))

  return (
    <div className="stack">
      <section className="card">
        <h2>Your 26-week plan</h2>
        <p className="helper">
          Starts {formatDayMonth(start)}. Peak week {peak} km. Three gym sessions and four runs a
          week, with recovery weeks and a rest day every Sunday.
          {factor < 1
            ? ` Distances are scaled to ${Math.round(factor * 100)}% of the standard plan to match your current ${profile.weeklyRunBaselineKm} km a week.`
            : ''}
        </p>
        <p className="helper">
          Tap a week to see every session. You can change the distance of any run; your edits are
          kept separately and can be reset.
        </p>
        <div className="form-actions">
          <Link className="button-link" to="/settings">
            Change start date or weekly base
          </Link>
        </div>
      </section>
      {programme.weeks.map((week) => (
        <WeekCard
          key={week.weekNumber}
          week={week}
          startDate={start}
          isCurrent={week.weekNumber === currentWeek}
          base={base}
          editedIds={editedIds}
        />
      ))}
    </div>
  )
}
