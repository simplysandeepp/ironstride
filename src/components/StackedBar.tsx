export type Segment = {
  label: string
  value: number
  tone: 'run' | 'gym' | 'nutrition' | 'body' | 'muted'
}

type Props = {
  segments: readonly Segment[]
  ariaLabel: string
  unit?: string
  showPercent?: boolean
}

/** One bar split into parts, with a legend that carries the numbers so colour is never the only cue. */
export function StackedBar({ segments, ariaLabel, unit = '', showPercent = true }: Props) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  if (total <= 0) return null
  return (
    <div className="stacked">
      <div className="stacked-track" role="img" aria-label={ariaLabel}>
        {segments.map((s) => (
          <span key={s.label} data-tone={s.tone} style={{ flexGrow: Math.max(0, s.value) }} />
        ))}
      </div>
      <ul className="stacked-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="swatch" data-tone={s.tone} aria-hidden="true" />
            {s.label}{' '}
            <strong>
              {showPercent
                ? `${Math.round((s.value / total) * 100)}%`
                : `${s.value}${unit ? ` ${unit}` : ''}`}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
