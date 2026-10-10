export type Tone = 'run' | 'gym' | 'nutrition' | 'body' | 'water'

type Props = { value: number; max: number; label: string; tone?: Tone }

/** An accessible bar that fills smoothly. Over-target values simply show full. */
export function ProgressBar({ value, max, label, tone }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className="bar-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      data-tone={tone}
    >
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
