import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useProgramme } from '../../app/useProgramme.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { db } from '../../db/database.ts'
import { getLastNDays, getLocalDateKey, type DateKey } from '../../domain/dates.ts'
import {
  buildHeatmap,
  groupActivitiesByDate,
  toWeekColumns,
  type HeatmapFilter,
} from '../../domain/heatmap.ts'
import { getPlannedSessions, getPlannedWorkoutsForDate } from '../../domain/planner.ts'
import { calculateStreak, getWeeklyTargetProgress } from '../../domain/streaks.ts'
import { DaySummary } from './DaySummary.tsx'
import { Heatmap } from './Heatmap.tsx'
import { getPlannedRestDays } from './progressModel.ts'

const FILTERS: { value: HeatmapFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gym', label: 'Gym' },
  { value: 'run', label: 'Runs' },
]

export function ProgressScreen({ today = getLocalDateKey() }: { today?: DateKey }) {
  const plan = useProgramme()
  const logs = useLiveQuery(async () => ({
    gym: await db.gymSessions.toArray(),
    runs: await db.runLogs.toArray(),
  }))
  const [filter, setFilter] = useState<HeatmapFilter>('all')
  const [selected, setSelected] = useState<DateKey>(today)

  if (plan === undefined || !logs)
    return <EmptyState title="Loading">Reading your history.</EmptyState>
  if (plan === null) {
    return <EmptyState title="Set up your plan">Add your details in Settings first.</EmptyState>
  }

  const { programme, profile } = plan
  const byDate = groupActivitiesByDate(logs.gym, logs.runs)
  const columns = toWeekColumns(buildHeatmap(today, byDate, filter))
  const restDays = getPlannedRestDays(
    programme,
    profile.trainingStartDate,
    getLastNDays(today, 365),
  )
  const hasAny = byDate.size > 0

  const gymDone = logs.gym
    .filter((s) => s.status === 'completed')
    .map((s) => ({ date: s.date, plannedWorkoutId: s.plannedWorkoutId }))
  const runDone = logs.runs
    .filter((r) => r.completed)
    .map((r) => ({ date: r.date, plannedWorkoutId: r.plannedWorkoutId }))
  const gymPlanned = getPlannedSessions(programme, profile.trainingStartDate, 'gym')
  const runPlanned = getPlannedSessions(programme, profile.trainingStartDate, 'run')
  const gymStreak = calculateStreak(gymPlanned, gymDone, today)
  const runStreak = calculateStreak(runPlanned, runDone, today)
  const weekGym = getWeeklyTargetProgress(gymPlanned, gymDone, today)
  const weekRun = getWeeklyTargetProgress(runPlanned, runDone, today)

  return (
    <div className="stack">
      <section className="card streaks" aria-label="Streaks">
        <div>
          <span className="metric">{gymStreak.current}</span>
          <span className="helper">Gym streak · best {gymStreak.best}</span>
        </div>
        <div>
          <span className="metric">{runStreak.current}</span>
          <span className="helper">Run streak · best {runStreak.best}</span>
        </div>
        <details className="streak-help">
          <summary>How streaks work</summary>
          <p className="helper">
            A streak counts planned sessions you completed in a row. Planned rest days never break
            it, and you do not need to train every day. A missed planned session ends it; just start
            again with the next one.
          </p>
        </details>
      </section>

      <section className="card" aria-label="This week">
        <h2>This week</h2>
        <p>
          Gym <strong>{weekGym.completed}</strong> / {weekGym.planned} · Runs{' '}
          <strong>{weekRun.completed}</strong> / {weekRun.planned}
        </p>
      </section>

      <section className="card" aria-labelledby="heat-heading">
        <h2 id="heat-heading">Activity</h2>
        <div className="chips" role="group" aria-label="Heatmap filter">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Heatmap columns={columns} selected={selected} restDays={restDays} onSelect={setSelected} />
        {!hasAny && (
          <p className="helper">
            Nothing here yet. Each completed gym session or run you save adds a square, so your year
            fills in as you train.
          </p>
        )}
        <div className="field">
          <label htmlFor="pick-date">Jump to a date</label>
          <input
            id="pick-date"
            type="date"
            max={today}
            value={selected}
            onChange={(e) => e.target.value && setSelected(e.target.value)}
          />
        </div>
      </section>

      <DaySummary
        date={selected}
        activities={byDate.get(selected)}
        planned={getPlannedWorkoutsForDate(programme, selected, profile.trainingStartDate)}
      />
    </div>
  )
}
