import { useState } from 'react'
import { Delta, KpiTile } from '../../components/KpiTile.tsx'
import { InsightList } from '../../components/InsightCard.tsx'
import { addDays, getWeekStart } from '../../domain/dates.ts'
import { getPlanAdherence } from '../../domain/insights/consistency.ts'
import {
  getIntakeSummary,
  getWeightProgress,
  targetForDate,
} from '../../domain/insights/fuelInsights.ts'
import type { Insight } from '../../domain/insights/insightCards.ts'
import { compareWeeks, getWeekSummary } from '../../domain/insights/weeklySummary.ts'
import { calculateStreak, getWeeklyTargetProgress } from '../../domain/streaks.ts'
import { ActivityCard } from './ActivityCard.tsx'
import { plannedKmForWeek } from './chartModel.ts'
import { PhaseCard } from './ProgressCharts.tsx'
import type { DashboardData } from './useDashboardData.ts'

export const INSIGHT_NOTE =
  'Insights are general observations from your own logs, not medical advice. Each one needs a minimum amount of data before it appears.'

export function OverviewTab({
  data,
  insights,
}: {
  data: DashboardData
  insights: readonly Insight[]
}) {
  const [expanded, setExpanded] = useState(false)
  const { today, programme, profile } = data

  const weekStart = getWeekStart(today)
  const thisWeek = getWeekSummary(data, weekStart)
  const lastWeek = getWeekSummary(data, addDays(weekStart, -7))
  const changes = compareWeeks(thisWeek, lastWeek).filter(
    (c) => c.current !== null || c.previous !== null,
  )

  const plannedKm = plannedKmForWeek(programme, profile.trainingStartDate, weekStart)
  const weekGym = getWeeklyTargetProgress(data.gymPlanned, data.gymDone, today)
  const weekRun = getWeeklyTargetProgress(data.runPlanned, data.runDone, today)
  const done = [...data.gymDone, ...data.runDone]
  const firstLogged = done.map((c) => c.date).sort()[0]
  // No verdict before the first logged session: we cannot tell "skipped" from "not recorded".
  const adherence = firstLogged
    ? getPlanAdherence([...data.gymPlanned, ...data.runPlanned], done, today, 28, firstLogged)
    : { due: 0, done: 0, share: null }
  const intake = getIntakeSummary(data.foodEntries, data.nutritionTargets, today)
  const target = targetForDate(data.nutritionTargets, today)
  const weight = getWeightProgress(data.bodyMeasurements, {
    minKg: profile.targetWeightMinKg,
    maxKg: profile.targetWeightMaxKg,
    startKg: profile.currentWeightKg,
  })
  const gymStreak = calculateStreak(data.gymPlanned, data.gymDone, today)
  const runStreak = calculateStreak(data.runPlanned, data.runDone, today)
  const kmDelta = thisWeek.runKm - lastWeek.runKm

  return (
    <>
      <section aria-label="Key numbers">
        <div className="kpis">
          <KpiTile
            label="Running this week"
            value={String(thisWeek.runKm)}
            unit="km"
            hint={
              <>
                {plannedKm !== undefined ? `of ${plannedKm} planned · ` : ''}
                <Delta
                  value={
                    lastWeek.runKm > 0 || thisWeek.runKm > 0 ? Math.round(kmDelta * 10) / 10 : null
                  }
                  unit="km"
                />{' '}
                vs last week
              </>
            }
          />
          <KpiTile
            label="Gym this week"
            value={`${weekGym.completed}/${weekGym.planned}`}
            unit="sessions"
            hint={
              thisWeek.gymSets > 0
                ? `${thisWeek.gymSets} sets · ${thisWeek.volumeKg.toLocaleString('en-GB')} kg lifted`
                : `Runs ${weekRun.completed}/${weekRun.planned} so far`
            }
          />
          <KpiTile
            label="Plan consistency"
            value={adherence.share === null ? '—' : `${Math.round(adherence.share * 100)}%`}
            hint={
              adherence.share === null
                ? 'Shows after a few logged sessions'
                : `${adherence.done} of ${adherence.due} planned sessions, last 4 weeks`
            }
          />
          <KpiTile
            label="Calories a day"
            value={intake.avgKcal === null ? '—' : intake.avgKcal.toLocaleString('en-GB')}
            unit={intake.avgKcal === null ? undefined : 'kcal'}
            hint={
              intake.avgKcal === null
                ? 'Log food to see your average'
                : `logged days, last 7${target ? ` · target ${target.caloriesKcal}` : ''}`
            }
          />
          <KpiTile
            label="Protein a day"
            value={intake.avgProteinG === null ? '—' : String(Math.round(intake.avgProteinG))}
            unit={intake.avgProteinG === null ? undefined : 'g'}
            hint={
              intake.daysLogged > 0
                ? `${intake.proteinHitDays} of ${intake.daysLogged} days on target`
                : 'Log food to see your average'
            }
          />
          <KpiTile
            label="Body weight"
            value={weight ? String(weight.latestAvgKg) : '—'}
            unit={weight ? 'kg' : undefined}
            hint={
              weight ? (
                weight.weeklyRateKg === null ? (
                  'Log weight weekly for a trend'
                ) : (
                  <>
                    <Delta value={weight.weeklyRateKg} unit="kg" digits={2} /> a week
                  </>
                )
              ) : (
                'Add a morning weight'
              )
            }
          />
        </div>
      </section>

      <section className="card" aria-labelledby="insights-heading">
        <h2 id="insights-heading">Insights</h2>
        <InsightList
          insights={insights}
          empty="Insights appear as you log runs, workouts, food and weight. Nothing to flag yet."
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
        <p className="helper">{INSIGHT_NOTE}</p>
      </section>

      <section className="card" aria-labelledby="compare-heading">
        <h2 id="compare-heading">This week vs last week</h2>
        {changes.length === 0 ? (
          <p className="helper">Log a few sessions and meals and the comparison appears here.</p>
        ) : (
          <ul className="compare">
            {changes.map((c) => (
              <li key={c.label}>
                <span>
                  {c.label}
                  <span className="helper compare-last">
                    {' '}
                    Last week:{' '}
                    {c.previous === null
                      ? '—'
                      : `${c.previous.toLocaleString('en-GB')}${c.unit ? ` ${c.unit}` : ''}`}
                  </span>
                </span>
                <strong>
                  {c.current === null
                    ? '—'
                    : `${c.current.toLocaleString('en-GB')}${c.unit ? ` ${c.unit}` : ''}`}
                </strong>
                <span className="compare-delta">
                  <Delta
                    value={c.delta}
                    unit={c.unit}
                    digits={c.unit === 'kg' && c.label === 'Average weight' ? 2 : 1}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      <PhaseCard
        today={today}
        programme={programme}
        profile={profile}
        runs={data.runLogs}
        gymSessions={data.gymSessions}
        measurements={data.bodyMeasurements}
        gymPlanned={data.gymPlanned}
        runPlanned={data.runPlanned}
        gymDone={data.gymDone}
        runDone={data.runDone}
      />

      <ActivityCard data={data} />
    </>
  )
}
