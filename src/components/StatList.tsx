import type { ReactNode } from 'react'

export type Stat = { label: string; value: ReactNode; hint?: ReactNode }

/** Label and value pairs for facts that do not need a chart. */
export function StatList({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="stats">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dt>{s.label}</dt>
          <dd>
            <strong>{s.value}</strong>
            {s.hint && <span className="helper stat-hint">{s.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
