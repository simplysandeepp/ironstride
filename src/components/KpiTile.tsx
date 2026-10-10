import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  unit?: string
  /** A short line under the number, such as a comparison or target. */
  hint?: ReactNode
}

/** One headline number. Numbers are tabular so a changing value does not shift the layout. */
export function KpiTile({ label, value, unit, hint }: Props) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

/** A change shown with an arrow and words, never colour alone. */
export function Delta({
  value,
  unit = '',
  digits = 1,
}: {
  value: number | null
  unit?: string
  digits?: number
}) {
  if (value === null) return <span>no comparison yet</span>
  if (value === 0) return <span>no change</span>
  const abs = Math.abs(value).toFixed(digits).replace(/\.0+$/, '')
  return (
    <span>
      <span aria-hidden="true">{value > 0 ? '▲' : '▼'}</span>
      <span className="sr-only">{value > 0 ? 'up' : 'down'}</span> {abs}
      {unit && ` ${unit}`}
    </span>
  )
}
