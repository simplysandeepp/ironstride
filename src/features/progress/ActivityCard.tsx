import { useState } from 'react'
import { getLastNDays, type DateKey } from '../../domain/dates.ts'
import {
  buildHeatmap,
  groupActivitiesByDate,
  toWeekColumns,
  type HeatmapFilter,
} from '../../domain/heatmap.ts'
import { getPlannedWorkoutsForDate } from '../../domain/planner.ts'
import { DaySummary } from './DaySummary.tsx'
import { Heatmap } from './Heatmap.tsx'
import { getPlannedRestDays } from './progressModel.ts'
import type { DashboardData } from './useDashboardData.ts'

const FILTERS: { value: HeatmapFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gym', label: 'Gym' },
  { value: 'run', label: 'Runs' },
]

/** The 365-day heatmap with its filters and the summary of the chosen day. Selection state stays here. */
export function ActivityCard({ data }: { data: DashboardData }) {
  const { today, programme, profile } = data
  const [filter, setFilter] = useState<HeatmapFilter>('all')
  const [selected, setSelected] = useState<DateKey>(today)

  const byDate = groupActivitiesByDate(data.gymSessions, data.runLogs)
  const columns = toWeekColumns(buildHeatmap(today, byDate, filter))
  const restDays = getPlannedRestDays(
    programme,
    profile.trainingStartDate,
    getLastNDays(today, 365),
  )

  return (
    <>
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
        {byDate.size === 0 && (
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
    </>
  )
}
