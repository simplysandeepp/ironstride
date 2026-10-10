import { useState } from 'react'
import { BarChart } from '../../components/BarChart.tsx'
import { HorizontalBars } from '../../components/HorizontalBars.tsx'
import { StatList } from '../../components/StatList.tsx'
import { formatDayMonth } from '../../domain/dates.ts'
import {
  getExercisePRs,
  getMuscleVolume,
  getRecentPRs,
  getSessionStats,
  getWeeklyVolume,
} from '../../domain/insights/strengthInsights.ts'
import type { DashboardData } from './useDashboardData.ts'

const INITIAL_PRS = 5
const weekLabel = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

/** The detailed strength view: personal bests, sets per muscle group and training volume. */
export function StrengthDetail({ data }: { data: DashboardData }) {
  const { gymSessions, today } = data
  const [showAll, setShowAll] = useState(false)
  const prs = getExercisePRs(gymSessions)
  const recent = new Set(getRecentPRs(gymSessions, today).map((p) => p.exerciseId))
  const muscles = getMuscleVolume(gymSessions, today)
  const volume = getWeeklyVolume(gymSessions, today)
  const stats = getSessionStats(gymSessions, today)
  const hasSets = muscles.some((m) => m.weeklyAverage > 0 || m.last7Days > 0)
  const hasVolume = volume.some((w) => w.volumeKg > 0)
  const shown = showAll ? prs : prs.slice(0, INITIAL_PRS)

  return (
    <>
      <section className="card" aria-labelledby="prs-heading">
        <h2 id="prs-heading">Personal bests</h2>
        {prs.length === 0 ? (
          <p className="helper">
            Finish a workout with weights and reps logged and your best lifts appear here.
          </p>
        ) : (
          <>
            <ul className="task-list">
              {shown.map((pr) => (
                <li key={pr.exerciseId} className="task">
                  <div>
                    <strong>{pr.name}</strong>
                    {recent.has(pr.exerciseId) && <span className="badge">New</span>}
                    <br />
                    <span className="helper">
                      {pr.loadKg} kg x {pr.reps} on {formatDayMonth(pr.date)} · {pr.sessions}{' '}
                      session{pr.sessions === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="metric-inline">about {pr.estimatedOneRepMax} kg</span>
                </li>
              ))}
            </ul>
            {prs.length > INITIAL_PRS && (
              <button type="button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                {showAll ? 'Show fewer' : `Show all ${prs.length}`}
              </button>
            )}
            <p className="helper">
              Figures are an estimated single-rep maximum from your best set (load x (1 + reps /
              30)). They are a guide for tracking progress, not a test.
            </p>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="muscle-heading">
        <h2 id="muscle-heading">Hard sets per muscle group</h2>
        {hasSets ? (
          <>
            <HorizontalBars
              tone="gym"
              markerLabel="four-week average"
              rows={muscles.map((m) => ({
                label: m.group,
                value: m.last7Days,
                marker: m.weeklyAverage,
                unit: 'sets',
              }))}
            />
            <p className="helper">
              Bars show the last 7 days; the white mark is your average week over the last 4. A set
              counts fully for its main muscle and half for other muscles it works. Roughly 10 to 20
              hard sets per muscle a week is a common guideline for building muscle; fewer is normal
              early in a plan.
            </p>
          </>
        ) : (
          <p className="helper">
            Finish a workout and your weekly sets for each muscle group appear here.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="volume-heading">
        <h2 id="volume-heading">Training volume</h2>
        <BarChart
          tone="gym"
          title="Total kilograms lifted per week"
          unit="kg"
          data={volume.map((w) => ({ label: weekLabel(w.weekStart), value: w.volumeKg }))}
          summary={
            hasVolume
              ? `Load lifted (kg x reps) over the last 8 weeks: ${volume.map((w) => w.volumeKg.toLocaleString('en-GB')).join(', ')}.`
              : 'Log loads and reps in your workouts and your weekly volume appears here.'
          }
        />
        <StatList
          stats={[
            {
              label: 'Sessions a week',
              value: stats.sessionsLast28Days ? String(stats.perWeek) : '—',
              hint: 'average, last 4 weeks',
            },
            {
              label: 'Average session',
              value: stats.averageMinutes ? `${stats.averageMinutes} min` : '—',
              hint: stats.averageMinutes
                ? undefined
                : 'Shows once sessions have start and finish times',
            },
          ]}
        />
      </section>
    </>
  )
}
