import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { formatDateLong, getLocalDateKey, type DateKey } from '../../domain/dates.ts'
import { isGymWorkout, isRunWorkout } from '../../domain/programme.ts'
import {
  addWater,
  getSupplements,
  getWaterServing,
  getWaterTarget,
  setSupplementStatus,
} from '../nutrition/habits.ts'
import { startOrResumeSession } from '../gym/sessionActions.ts'
import { buildTodayModel, type TaskStatus } from './todayModel.ts'

const STATUS_LABEL: Record<TaskStatus, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  pending: 'To do',
}

type Props = { today?: DateKey }

export function TodayScreen({ today = getLocalDateKey() }: Props) {
  const plan = useProgramme()
  const navigate = useNavigate()
  const data = useLiveQuery(
    async () => ({
      gymSessions: await db.gymSessions.toArray(),
      runLogs: await db.runLogs.toArray(),
      foodEntries: await repositories.foodEntries.onDate(today),
      targets: await repositories.nutritionTargets.forDate(today),
      supplements: await repositories.supplementLogs.onDate(today),
      water: await repositories.waterEntries.onDate(today),
      settings: await repositories.settings.get(),
    }),
    [today],
  )

  if (plan === undefined || !data) {
    return <EmptyState title="Loading">Reading your plan.</EmptyState>
  }
  if (plan === null) {
    return (
      <EmptyState title="Set up your plan">
        Add your details in Settings to see your daily plan.
      </EmptyState>
    )
  }

  const model = buildTodayModel({
    programme: plan.programme,
    startDate: plan.profile.trainingStartDate,
    today,
    gymSessions: data.gymSessions,
    runLogs: data.runLogs,
    foodEntries: data.foodEntries,
    targets: data.targets,
  })
  const waterMl = data.water.reduce((sum, w) => sum + w.amountMl, 0)
  const takenKeys = new Set(
    data.supplements.filter((s) => s.status === 'taken').map((s) => s.supplement),
  )

  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">{formatDateLong(today)}</p>
        {model.phase === 'active' && (
          <p>
            Week {model.weekNumber} of 26 · {model.blockName}
            {model.isCutback ? ' · Recovery week' : ''}
          </p>
        )}
        {model.phase === 'before-start' && (
          <p>Your plan starts on {formatDateLong(plan.profile.trainingStartDate)}.</p>
        )}
        {model.phase === 'finished' && <p>You have finished the 26-week plan. Well done.</p>}
        {model.phase === 'active' && (
          <p className="helper">
            This week: gym {model.weekGym.completed}/{model.weekGym.planned} · runs{' '}
            {model.weekRun.completed}/{model.weekRun.planned}
          </p>
        )}
      </section>

      {model.phase === 'active' && (
        <section className="card" aria-labelledby="plan-heading">
          <h2 id="plan-heading">{model.isRestDay ? 'Recovery day' : "Today's plan"}</h2>
          {model.isRestDay && (
            <p className="helper">
              Rest is part of training. An easy walk or mobility is optional.
            </p>
          )}
          <ul className="task-list">
            {model.tasks
              .filter((t) => !model.isRestDay || t.workout.type !== 'rest')
              .map(({ workout, status }) => (
                <li key={workout.id} className="task">
                  <div>
                    <strong>{workout.title}</strong>
                    {workout.plannedDistanceKm !== undefined && (
                      <span className="metric-inline"> {workout.plannedDistanceKm} km</span>
                    )}
                  </div>
                  <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
                </li>
              ))}
          </ul>
          {model.nextTask && isGymWorkout(model.nextTask.workout) && (
            // Opens the workout itself, so starting from Today is one tap.
            <button
              type="button"
              className="primary"
              onClick={async () => {
                const next = model.nextTask
                if (!next) return
                const session = await startOrResumeSession(next.workout, today)
                navigate(`/gym/session/${session.id}`)
              }}
            >
              {model.nextTask.status === 'in-progress' ? 'Resume workout' : 'Start workout'}
            </button>
          )}
          {model.nextTask && isRunWorkout(model.nextTask.workout) && (
            <Link
              className="button-link primary"
              to={`/run/log?planned=${model.nextTask.workout.id}`}
            >
              Log run
            </Link>
          )}
        </section>
      )}

      <Link className="button-link" to="/plan">
        See the full 26-week plan
      </Link>

      <section className="card streaks" aria-label="Streaks">
        <div>
          <span className="metric">{model.gymStreak.current}</span>
          <span className="helper">Gym streak (best {model.gymStreak.best})</span>
        </div>
        <div>
          <span className="metric">{model.runStreak.current}</span>
          <span className="helper">Run streak (best {model.runStreak.best})</span>
        </div>
      </section>

      <section className="card" aria-labelledby="food-heading">
        <h2 id="food-heading">Nutrition today</h2>
        <p>
          <span className="metric-inline">{model.nutrition.caloriesKcal}</span>
          {model.targets ? ` / ${model.targets.caloriesKcal} kcal` : ' kcal'}
        </p>
        <p>
          <span className="metric-inline">{model.nutrition.proteinG}</span>
          {model.targets ? ` / ${model.targets.proteinG} g protein` : ' g protein'}
        </p>
      </section>

      <section className="card" aria-labelledby="quick-heading">
        <h2 id="quick-heading">Quick log</h2>
        {getSupplements(data.settings)
          .filter((s) => s.enabled)
          .map((s) => (
            <label key={s.key} className="check">
              <input
                type="checkbox"
                checked={takenKeys.has(s.key)}
                onChange={(e) =>
                  void setSupplementStatus(today, s, e.target.checked ? 'taken' : null)
                }
              />
              {s.label} ({s.amount} {s.unit})
            </label>
          ))}
        <p>
          Water: <span className="metric-inline">{waterMl}</span> / {getWaterTarget(data.settings)}{' '}
          ml
        </p>
        <button type="button" onClick={() => void addWater(today, getWaterServing(data.settings))}>
          Add {getWaterServing(data.settings)} ml water
        </button>
      </section>
    </div>
  )
}
