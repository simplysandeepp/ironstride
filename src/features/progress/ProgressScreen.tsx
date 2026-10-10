import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingCard } from '../../components/LoadingCard.tsx'
import { TabPanel, Tabs, type TabDef } from '../../components/Tabs.tsx'
import { getLocalDateKey, type DateKey } from '../../domain/dates.ts'
import { buildInsights } from '../../domain/insights/insightCards.ts'
import { FuelTab, RunTab, StrengthTab } from './AreaTabs.tsx'
import { OverviewTab } from './OverviewTab.tsx'
import { useDashboardData } from './useDashboardData.ts'

const TABS: readonly TabDef[] = [
  { id: 'overview', label: 'Overview', domain: 'body' },
  { id: 'run', label: 'Run', domain: 'run' },
  { id: 'strength', label: 'Strength', domain: 'gym' },
  { id: 'fuel', label: 'Fuel', domain: 'nutrition' },
]

const PREFIX = 'dash'

export function ProgressScreen({ today = getLocalDateKey() }: { today?: DateKey }) {
  const data = useDashboardData(today)
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab = TABS.some((t) => t.id === requested) ? (requested as string) : 'overview'

  if (data === undefined) return <LoadingCard />
  if (data === null) {
    return <EmptyState title="Set up your plan">Add your details in Settings first.</EmptyState>
  }

  const insights = buildInsights(data)
  const domain = TABS.find((t) => t.id === tab)?.domain

  return (
    <div>
      <Tabs
        tabs={TABS}
        value={tab}
        label="Dashboard sections"
        idPrefix={PREFIX}
        onChange={(id) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })}
      />
      <TabPanel id={tab} idPrefix={PREFIX} domain={domain}>
        {tab === 'overview' && <OverviewTab data={data} insights={insights} />}
        {tab === 'run' && <RunTab data={data} insights={insights} />}
        {tab === 'strength' && <StrengthTab data={data} insights={insights} />}
        {tab === 'fuel' && <FuelTab data={data} insights={insights} />}
      </TabPanel>
    </div>
  )
}
