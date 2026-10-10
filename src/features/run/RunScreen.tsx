import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { db } from '../../db/database.ts'
import {
  formatDateLong,
  getLocalDateKey,
  getWeekStart,
  addDays,
  type DateKey,
} from '../../domain/dates.ts'
import { getProgrammeWeekForDate, getWorkoutDate } from '../../domain/planner.ts'
import { getWeekRunKm, isRunWorkout } from '../../domain/programme.ts'
import { calculateWeeklyRunDistance, getLoadWarning } from '../../domain/running.ts'
import { isPlannedSessionDone } from '../../domain/streaks.ts'

export function RunScreen({ today = getLocalDateKey() }: { today?: DateKey }) {
  const plan = useProgramme()
  const runs = useLiveQuery(() => db.runLogs.toArray())

  if (plan === undefined || !runs)
    return <EmptyState title="Loading">Reading your plan.</EmptyState>
  if (plan === null) {
    return <EmptyState title="Set up your plan">Add your details in Settings first.</EmptyState>
  }

  const { programme, profile } = plan
  const week = getProgrammeWeekForDate(programme, today, profile.trainingStartDate)
  const doneRuns = runs
    .filter((r) => r.completed)
    .map((r) => ({ date: r.date, plannedWorkoutId: r.plannedWorkoutId }))
  const weekKm = calculateWeeklyRunDistance(runs, today)
  const recentWeeks = [1, 2, 3, 4].map((i) =>
    calculateWeeklyRunDistance(runs, addDays(getWeekStart(today), -7 * i)),
  )
  const plannedKm = week ? getWeekRunKm(week) : 0
  const warning = week
    ? getLoadWarning(plannedKm, profile.weeklyRunBaselineKm, recentWeeks)
    : undefined

  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">
          <span className="metric-inline">{weekKm}</span>
          {week ? ` / ${plannedKm} km this week` : ' km this week'}
        </p>
        {week && (
          <p className="helper">
            Week {week.weekNumber} · {week.blockName}
            {week.isCutback ? ' · Recovery week' : ''}
          </p>
        )}
        {warning && <p className="hint">{warning}</p>}
        <Link className="button-link" to="/run/log">
          Log an unplanned run
        </Link>
      </section>

      {week ? (
        <section className="card" aria-labelledby="runs-heading">
          <h2 id="runs-heading">This week&apos;s runs</h2>
          <ul className="task-list">
            {week.workouts.filter(isRunWorkout).map((workout) => {
              const date = getWorkoutDate(workout, profile.trainingStartDate)
              const done = isPlannedSessionDone({ id: workout.id, date }, doneRuns)
              return (
                <li key={workout.id} className="task">
                  <div>
                    <strong>{workout.title}</strong>
                    <span className="metric-inline"> {workout.plannedDistanceKm} km</span>
                    <br />
                    <span className="helper">{formatDateLong(date)}</span>
                  </div>
                  {done ? (
                    <span className="status status-done">Done</span>
                  ) : (
                    <Link className="button-link" to={`/run/log?planned=${workout.id}`}>
                      Log run
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="helper">{week.notes}</p>
        </section>
      ) : (
        <EmptyState title="No run scheduled">
          Your plan has not started yet, or has finished. You can still log an unplanned run.
        </EmptyState>
      )}
    </div>
  )
}
