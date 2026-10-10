import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { db } from '../../db/database.ts'
import { formatDateLong, getLocalDateKey, type DateKey } from '../../domain/dates.ts'
import { getProgrammeWeekForDate, getWorkoutDate } from '../../domain/planner.ts'
import { isGymWorkout, type ProgrammeWorkout } from '../../domain/programme.ts'
import { isPlannedSessionDone } from '../../domain/streaks.ts'
import { completedSetCount } from './sessionModel.ts'
import { startOrResumeSession } from './sessionActions.ts'

type Props = { today?: DateKey }

export function GymScreen({ today = getLocalDateKey() }: Props) {
  const plan = useProgramme()
  const sessions = useLiveQuery(() => db.gymSessions.toArray())
  const navigate = useNavigate()

  if (plan === undefined || !sessions)
    return <EmptyState title="Loading">Reading your plan.</EmptyState>
  if (plan === null) {
    return <EmptyState title="Set up your plan">Add your details in Settings first.</EmptyState>
  }

  const { programme, profile } = plan
  const week = getProgrammeWeekForDate(programme, today, profile.trainingStartDate)
  if (!week) {
    return (
      <EmptyState title="No gym session scheduled">
        Your plan has not started yet, or has finished.
      </EmptyState>
    )
  }

  const recent = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({ date: s.date, plannedWorkoutId: s.plannedWorkoutId }))
  const gymWorkouts = week.workouts.filter(isGymWorkout)
  const dated = gymWorkouts.map((workout) => ({
    workout,
    date: getWorkoutDate(workout, profile.trainingStartDate),
  }))
  const isDone = (workout: ProgrammeWorkout, date: DateKey) =>
    isPlannedSessionDone({ id: workout.id, date }, completed)
  const next = dated.find((d) => !isDone(d.workout, d.date) && d.date >= today)
  const inProgress = (workoutId: string) =>
    sessions.some((s) => s.plannedWorkoutId === workoutId && s.status === 'in-progress')

  async function start(workout: ProgrammeWorkout) {
    const session = await startOrResumeSession(workout, today)
    navigate(`/gym/session/${session.id}`)
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>{week.blockName}</h2>
        <p className="helper">
          Week {week.weekNumber} · {week.focus}
        </p>
        {next ? (
          <>
            <p>
              <strong>Next: {next.workout.title}</strong>
              <br />
              <span className="helper">
                {formatDateLong(next.date)} · about {next.workout.estimatedMinutes} min ·{' '}
                {next.workout.exercises?.length} exercises
              </span>
            </p>
            <button type="button" className="primary" onClick={() => void start(next.workout)}>
              {inProgress(next.workout.id) ? 'Resume workout' : 'Start workout'}
            </button>
          </>
        ) : (
          <p>All gym sessions for this week are done. Enjoy the recovery.</p>
        )}
      </section>

      <section className="card" aria-labelledby="week-heading">
        <h2 id="week-heading">This week</h2>
        <ul className="task-list">
          {dated.map(({ workout, date }) => (
            <li key={workout.id} className="task">
              <div>
                <strong>{workout.title}</strong>
                <br />
                <span className="helper">{formatDateLong(date)}</span>
              </div>
              <span className={`status ${isDone(workout, date) ? 'status-done' : ''}`}>
                {isDone(workout, date) ? 'Done' : inProgress(workout.id) ? 'In progress' : 'To do'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Link className="button-link" to="/plan">
        See the full 26-week plan
      </Link>

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">Recent workouts</h2>
        {recent.length === 0 ? (
          <p className="helper">Finished workouts will appear here.</p>
        ) : (
          <ul className="task-list">
            {recent.map((s) => (
              <li key={s.id} className="task">
                <Link to={`/gym/session/${s.id}`}>
                  {s.title} · {formatDateLong(s.date)}
                </Link>
                <span className="helper">{completedSetCount(s)} sets</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
