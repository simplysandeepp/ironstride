import { useState } from 'react'
import { InsightList } from '../../components/InsightCard.tsx'
import type { Insight } from '../../domain/insights/insightCards.ts'
import { RunCharts, StrengthCharts, WeightCard, type ChartProps } from './ProgressCharts.tsx'
import type { DashboardData } from './useDashboardData.ts'

const toChartProps = (data: DashboardData): ChartProps => ({
  today: data.today,
  programme: data.programme,
  profile: data.profile,
  runs: data.runLogs,
  gymSessions: data.gymSessions,
  measurements: data.bodyMeasurements,
  gymPlanned: data.gymPlanned,
  runPlanned: data.runPlanned,
  gymDone: data.gymDone,
  runDone: data.runDone,
})

function AreaInsights({
  insights,
  id,
  title,
  empty,
}: {
  insights: readonly Insight[]
  id: string
  title: string
  empty: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <InsightList
        insights={insights}
        empty={empty}
        initial={4}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </section>
  )
}

export function RunTab({ data, insights }: { data: DashboardData; insights: readonly Insight[] }) {
  return (
    <>
      <AreaInsights
        id="run-insights"
        title="Running insights"
        insights={insights.filter((i) => i.area === 'run')}
        empty="Log a few runs, with time and effort, and your load, pace and effort insights appear here."
      />
      <RunCharts {...toChartProps(data)} />
    </>
  )
}

export function StrengthTab({
  data,
  insights,
}: {
  data: DashboardData
  insights: readonly Insight[]
}) {
  return (
    <>
      <AreaInsights
        id="gym-insights"
        title="Strength insights"
        insights={insights.filter((i) => i.area === 'gym')}
        empty="Finish a few workouts with weights logged and your best lifts and progress appear here."
      />
      <StrengthCharts {...toChartProps(data)} />
    </>
  )
}

export function FuelTab({ data, insights }: { data: DashboardData; insights: readonly Insight[] }) {
  return (
    <>
      <AreaInsights
        id="fuel-insights"
        title="Fuel and body insights"
        insights={insights.filter((i) => i.area === 'fuel' || i.area === 'body')}
        empty="Log food for a few days and a morning weight each week, and your intake and body insights appear here."
      />
      <WeightCard {...toChartProps(data)} />
    </>
  )
}
