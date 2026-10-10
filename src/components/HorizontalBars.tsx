export type BarRow = {
  label: string
  value: number
  /** A reference such as your 4-week average. */ marker?: number
  unit?: string
}

type Props = {
  rows: readonly BarRow[]
  tone?: 'run' | 'gym' | 'nutrition' | 'body'
  markerLabel?: string
}

/** Labelled horizontal bars. The numbers are text, so the bars are decoration for sighted users. */
export function HorizontalBars({ rows, tone, markerLabel }: Props) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.value, r.marker ?? 0]))
  return (
    <ul className="hbars" data-tone={tone}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
            {r.marker !== undefined && (
              <span className="hbar-marker" style={{ left: `${(r.marker / max) * 100}%` }} />
            )}
          </span>
          <span className="hbar-value">
            <strong>{r.value}</strong>
            {r.unit ? ` ${r.unit}` : ''}
            {r.marker !== undefined && markerLabel && (
              <span className="sr-only">{`, ${markerLabel} ${r.marker}`}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
