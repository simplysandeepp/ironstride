import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart } from '../../components/BarChart.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { repositories } from '../../db/repositories.ts'
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
import {
  calculateWeeklyRunDistance,
  formatPace,
  getLoadWarning,
  getWeeklyRunSummaries,
} from '../../domain/running.ts'
import { isPlannedSessionDone } from '../../domain/streaks.ts'
import { RUN_TYPE_LABELS } from './runForm.ts'

export function RunScreen({ today = getLocalDateKey() }: { today?: DateKey }) {
  const plan = useProgramme()
  const [deleting, setDeleting] = useState<string | null>(null)
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
  const summaries = getWeeklyRunSummaries(runs, today)
  const history = [...runs]
    .filter((r) => r.completed)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
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

      <Link className="button-link" to="/plan">
        See the full 26-week plan
      </Link>

      <section className="card" aria-labelledby="chart-heading">
        <h2 id="chart-heading">Weekly distance</h2>
        <BarChart
          title="Kilometres run per week, last 8 weeks"
          unit="km"
          data={summaries.map((w) => ({
            label: w.weekStart.slice(8) + '/' + w.weekStart.slice(5, 7),
            value: w.km,
          }))}
          summary={
            summaries.some((w) => w.km > 0)
              ? `Last 8 weeks: ${summaries.map((w) => w.km).join(', ')} km. Longest run ${Math.max(...summaries.map((w) => w.longestRunKm))} km.`
              : 'No runs logged yet. Log a run and your weekly distance appears here.'
          }
        />
      </section>

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">Run history</h2>
        {history.length === 0 ? (
          <p className="helper">Completed runs will appear here.</p>
        ) : (
          <ul className="task-list">
            {history.map((r) => (
              <li key={r.id} className="task">
                <div>
                  <strong>
                    {r.actualDistanceKm} km · {RUN_TYPE_LABELS[r.type]}
                  </strong>
                  <br />
                  <span className="helper">
                    {formatDateLong(r.date)}
                    {r.averagePaceSecondsPerKm
                      ? ` · ${formatPace(r.averagePaceSecondsPerKm)} /km`
                      : ''}
                    {r.rpe ? ` · effort ${r.rpe}` : ''}
                  </span>
                </div>
                <div className="header-actions">
                  <Link
                    className="button-link"
                    to={`/run/log?edit=${r.id}`}
                    aria-label={`Edit run on ${r.date}`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleting(r.id)}
                    aria-label={`Delete run on ${r.date}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {deleting && (
        <ConfirmDialog
          title="Delete this run?"
          message="It will be removed from your history, weekly totals and heatmap."
          confirmLabel="Delete"
          onConfirm={() => {
            void repositories.runLogs.remove(deleting)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
