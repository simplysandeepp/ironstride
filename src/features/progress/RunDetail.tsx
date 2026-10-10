import { LineChart } from '../../components/LineChart.tsx'
import { LoadGauge } from '../../components/LoadGauge.tsx'
import { StackedBar } from '../../components/StackedBar.tsx'
import { StatList } from '../../components/StatList.tsx'
import { formatDayMonth } from '../../domain/dates.ts'
import {
  getEasyEffortTrend,
  getEasyPaceTrend,
  getEffortDiscipline,
  getIntensityMix,
  getLoadRamp,
  getPaceSeries,
  getPlannedEasyShare,
  getRunBests,
  getRunTotals,
} from '../../domain/insights/runInsights.ts'
import { formatPace } from '../../domain/running.ts'
import type { DashboardData } from './useDashboardData.ts'

const EASY_EFFORT_TYPES = ['easy', 'long', 'recovery', 'other'] as const
const pct = (n: number) => `${Math.round(n * 100)}%`

/** The detailed running view: load, effort, intensity, pace and personal bests. */
export function RunDetail({ data }: { data: DashboardData }) {
  const { runLogs, today, programme, profile } = data
  const ramp = getLoadRamp(runLogs, today)
  const effort = getEffortDiscipline(runLogs, today)
  const effortTrend = getEasyEffortTrend(runLogs, today)
  const mix = getIntensityMix(runLogs, today)
  const plannedEasy = getPlannedEasyShare(programme, profile.trainingStartDate, today)
  const paceTrend = getEasyPaceTrend(runLogs, today)
  const paceSeries = getPaceSeries(runLogs, EASY_EFFORT_TYPES).slice(-20)
  const bests = getRunBests(runLogs)
  const totals = getRunTotals(runLogs, today)

  return (
    <>
      <section className="card" aria-labelledby="load-heading">
        <h2 id="load-heading">Training load</h2>
        <LoadGauge ramp={ramp} />
        <p className="helper">
          Compares your last 7 days with your average week over the 4 weeks before. Recovery weeks
          read lighter, and a sudden jump reads as a spike.
        </p>
      </section>

      <section className="card" aria-labelledby="intensity-heading">
        <h2 id="intensity-heading">Effort and intensity</h2>
        {mix ? (
          <>
            <StackedBar
              ariaLabel={`Last 4 weeks: ${pct(mix.easyShare)} easy, ${pct(1 - mix.easyShare)} hard, by distance.`}
              segments={[
                { label: 'Easy and long', value: mix.easyKm, tone: 'run' },
                { label: 'Intervals and tempo', value: mix.hardKm, tone: 'body' },
              ]}
            />
            {plannedEasy !== null && (
              <p className="helper">
                Your plan asks for about {pct(plannedEasy)} easy over the same weeks.
              </p>
            )}
          </>
        ) : (
          <p className="helper">
            Log a few runs and the split between easy and hard running appears here.
          </p>
        )}
        <StatList
          stats={[
            {
              label: 'Easy runs kept easy',
              value: effort ? `${effort.withinEasy} of ${effort.rated}` : '—',
              hint: effort ? 'rated 4/10 or lower' : 'Rate at least 3 easy runs to see this',
            },
            {
              label: 'Easy-run effort',
              value: effortTrend ? `${effortTrend.recent} / 10` : '—',
              hint: effortTrend
                ? `${effortTrend.previous} in the 2 weeks before`
                : 'Needs rated easy runs in two fortnights',
            },
          ]}
        />
      </section>

      <section className="card" aria-labelledby="pace-heading">
        <h2 id="pace-heading">Easy pace</h2>
        <LineChart
          tone="run"
          title="Average pace of easy-effort runs"
          unit="min per km, lower is faster"
          format={(v) => formatPace(v)}
          points={paceSeries.map((p) => ({ date: p.date, value: p.secPerKm }))}
          summary={
            paceSeries.length === 0
              ? 'Add a time when you log runs and your pace trend appears here.'
              : paceTrend
                ? `Pace is ${paceTrend.direction}: ${formatPace(paceTrend.recentSecPerKm)} /km over the last 2 weeks against ${formatPace(paceTrend.previousSecPerKm)} before.`
                : `${paceSeries.length} run${paceSeries.length === 1 ? '' : 's'} with a pace so far. The trend needs two runs in each of two fortnights.`
          }
        />
      </section>

      <section className="card" aria-labelledby="bests-heading">
        <h2 id="bests-heading">Personal bests and totals</h2>
        <StatList
          stats={[
            {
              label: 'Longest run',
              value: bests.longest ? `${bests.longest.km} km` : '—',
              hint: bests.longest ? formatDayMonth(bests.longest.date) : undefined,
            },
            {
              label: 'Best week',
              value: bests.bestWeek ? `${bests.bestWeek.km} km` : '—',
              hint: bests.bestWeek
                ? `week of ${formatDayMonth(bests.bestWeek.weekStart)}`
                : undefined,
            },
            {
              label: 'Fastest pace (3 km or more)',
              value: bests.fastestPace ? `${formatPace(bests.fastestPace.secPerKm)} /km` : '—',
              hint: bests.fastestPace
                ? `${bests.fastestPace.km} km on ${formatDayMonth(bests.fastestPace.date)}`
                : undefined,
            },
            { label: 'Last 4 weeks', value: `${totals.last28Km} km` },
            { label: 'All runs logged', value: `${totals.runCount} runs, ${totals.totalKm} km` },
          ]}
        />
      </section>
    </>
  )
}
