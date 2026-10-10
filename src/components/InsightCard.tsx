import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { Insight, InsightTone } from '../domain/insights/insightCards.ts'

const TONE: Record<InsightTone, { label: string; Icon: typeof Info }> = {
  good: { label: 'Good news', Icon: CheckCircle2 },
  info: { label: 'Note', Icon: Info },
  watch: { label: 'Heads up', Icon: AlertTriangle },
}

export function InsightCard({ insight }: { insight: Insight }) {
  const { label, Icon } = TONE[insight.tone]
  return (
    <li className="insight" data-tone={insight.tone}>
      <Icon aria-hidden="true" size={20} className="insight-icon" />
      <div>
        <p className="insight-kicker">{label}</p>
        <p className="insight-title">{insight.title}</p>
        <p className="insight-detail">{insight.detail}</p>
      </div>
    </li>
  )
}

type ListProps = { insights: readonly Insight[]; empty: string; initial?: number }

/** A list of insights with a "show all" control, and a friendly message when there is nothing to say yet. */
export function InsightList({
  insights,
  empty,
  initial = 5,
  expanded,
  onToggle,
}: ListProps & { expanded: boolean; onToggle: () => void }) {
  if (insights.length === 0) return <p className="helper">{empty}</p>
  const shown = expanded ? insights : insights.slice(0, initial)
  return (
    <>
      <ul className="insights">
        {shown.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
      </ul>
      {insights.length > initial && (
        <button type="button" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'Show fewer' : `Show all ${insights.length}`}
        </button>
      )}
    </>
  )
}
