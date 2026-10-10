import { useState } from 'react'
import { BarChart } from '../../components/BarChart.tsx'
import { LineChart } from '../../components/LineChart.tsx'
import { getExercise } from '../../data/exerciseLibrary.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { Programme } from '../../domain/programme.ts'
import { getWeeklyRunSummaries } from '../../domain/running.ts'
import type { PlannedSession } from '../../domain/planner.ts'
import type { CompletedSession } from '../../domain/streaks.ts'
import type { BodyMeasurement, GymSession, RunLog, UserProfile } from '../../domain/types.ts'
import { getWeightTrend } from '../../domain/weightTrend.ts'
import {
  getLoggedExercises,
  getPhaseSummary,
  getStrengthSeries,
  getWeeklySessionCounts,
  plannedKmForWeek,
} from './chartModel.ts'

export type ChartProps = {
  today: DateKey
  programme: Programme
  profile: UserProfile
  runs: readonly RunLog[]
  gymSessions: readonly GymSession[]
  measurements: readonly BodyMeasurement[]
  gymPlanned: readonly PlannedSession[]
  runPlanned: readonly PlannedSession[]
  gymDone: readonly CompletedSession[]
  runDone: readonly CompletedSession[]
}

const weekLabel = (weekStart: DateKey) => `${weekStart.slice(8)}/${weekStart.slice(5, 7)}`

export function PhaseCard(props: ChartProps) {
  const { today, programme, profile } = props
  const phase = getPhaseSummary(programme, profile.trainingStartDate, today)

  return (
    <>
      {phase && (
        <section className="card" aria-labelledby="phase-heading">
          <h2 id="phase-heading">Where you are</h2>
          <p>
            <strong>Week {phase.weekNumber} of 26</strong> · {phase.blockName}
          </p>
          <p className="helper">{phase.focus}</p>
          <p className="helper">
            {phase.weeksLeftInBlock === 0
              ? 'Last week of this block.'
              : `${phase.weeksLeftInBlock} more week${phase.weeksLeftInBlock === 1 ? '' : 's'} in this block.`}
            {phase.nextCutbackWeek ? ` Next recovery week: week ${phase.nextCutbackWeek}.` : ''}
            {phase.plannedLongRunKm ? ` This week's long run: ${phase.plannedLongRunKm} km.` : ''}
          </p>
        </section>
      )}
    </>
  )
}

export function RunCharts(props: ChartProps) {
  const { today, programme, profile, runs } = props
  const summaries = getWeeklyRunSummaries(runs, today)
  const runWeeks = getWeeklySessionCounts(props.runPlanned, props.runDone, today)
  const hasRuns = summaries.some((w) => w.km > 0)

  return (
    <>
      <section className="card" aria-labelledby="km-heading">
        <h2 id="km-heading">Weekly distance</h2>
        <BarChart
          title="Kilometres per week against plan"
          unit="km"
          data={summaries.map((w) => ({
            label: weekLabel(w.weekStart),
            value: w.km,
            marker: plannedKmForWeek(programme, profile.trainingStartDate, w.weekStart),
          }))}
          summary={
            hasRuns
              ? `Bars are kilometres run; gold lines are the plan. Last 8 weeks: ${summaries.map((w) => w.km).join(', ')}.`
              : 'No runs logged yet. Log a run and your weekly distance appears here.'
          }
        />
      </section>

      <section className="card" aria-labelledby="long-heading">
        <h2 id="long-heading">Longest run each week</h2>
        <BarChart
          title="Longest run per week"
          unit="km"
          data={summaries.map((w) => ({ label: weekLabel(w.weekStart), value: w.longestRunKm }))}
          summary={
            hasRuns
              ? `Longest in the last 8 weeks: ${Math.max(...summaries.map((w) => w.longestRunKm))} km.`
              : 'Your long-run progression appears after your first runs.'
          }
        />
      </section>

      <section className="card" aria-labelledby="runs-heading">
        <h2 id="runs-heading">Runs vs target</h2>
        <BarChart
          title="Completed runs per week"
          unit="runs"
          data={runWeeks.map((w) => ({
            label: weekLabel(w.weekStart),
            value: w.completed,
            marker: w.planned || undefined,
          }))}
          summary={`Gold lines are planned runs. Completed: ${runWeeks.map((w) => `${w.completed}/${w.planned}`).join(', ')}.`}
        />
      </section>
    </>
  )
}

export function StrengthCharts(props: ChartProps) {
  const { today, gymSessions } = props
  const [exerciseId, setExerciseId] = useState('')
  const gymWeeks = getWeeklySessionCounts(props.gymPlanned, props.gymDone, today)
  const logged = getLoggedExercises(gymSessions)
  const chosen = exerciseId || logged[0]?.id || ''
  const strength = chosen ? getStrengthSeries(gymSessions, chosen) : []

  return (
    <>
      <section className="card" aria-labelledby="gym-heading">
        <h2 id="gym-heading">Gym sessions vs target</h2>
        <BarChart
          tone="gym"
          title="Completed gym sessions per week"
          unit="sessions"
          data={gymWeeks.map((w) => ({
            label: weekLabel(w.weekStart),
            value: w.completed,
            marker: w.planned || undefined,
          }))}
          summary={`Gold lines are planned sessions. Completed: ${gymWeeks.map((w) => `${w.completed}/${w.planned}`).join(', ')}.`}
        />
      </section>

      <section className="card" aria-labelledby="strength-heading">
        <h2 id="strength-heading">Strength progression</h2>
        {logged.length === 0 ? (
          <p className="helper">Finish a workout with weights logged and your lifts appear here.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="strength-exercise">Exercise</label>
              <select
                id="strength-exercise"
                value={chosen}
                onChange={(e) => setExerciseId(e.target.value)}
              >
                {logged.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <LineChart
              tone="gym"
              title={`Top set load for ${getExercise(chosen)?.name ?? chosen}`}
              unit="kg"
              points={strength}
              summary={
                strength.length > 0
                  ? `Heaviest completed set per session. Latest ${strength.at(-1)!.value} kg after ${strength.length} session${strength.length === 1 ? '' : 's'}.`
                  : 'No loads logged for this exercise yet.'
              }
            />
          </>
        )}
      </section>
    </>
  )
}

export function WeightCard(props: ChartProps) {
  const { profile, measurements } = props
  const trend = getWeightTrend(measurements)
  const latestWeight = trend.at(-1)

  return (
    <>
      <section className="card" aria-labelledby="weight-heading">
        <h2 id="weight-heading">Body weight</h2>
        <LineChart
          tone="body"
          title="Body weight trend"
          unit="kg"
          points={trend.map((t) => ({ date: t.date, value: t.weightKg, avg: t.rollingAvgKg }))}
          band={{ min: profile.targetWeightMinKg, max: profile.targetWeightMaxKg }}
          summary={
            latestWeight
              ? `Latest ${latestWeight.weightKg} kg. Weight gain is not all muscle; judge it over weeks alongside strength and waist.`
              : 'No weight logged yet. Add a morning weight on the Nutrition screen.'
          }
        />
      </section>
    </>
  )
}
