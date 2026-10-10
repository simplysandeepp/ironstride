import { daysBetween, type DateKey } from '../domain/dates.ts'

export type LinePoint = { date: DateKey; value: number; avg?: number }

type Props = {
  points: readonly LinePoint[]
  /** Optional target range drawn as a band, separate from the real data. */
  band?: { min: number; max: number }
  title: string
  unit: string
  summary: string
}

const W = 320
const H = 170
const PAD = { top: 12, bottom: 24, left: 34, right: 10 }

/** Actual entries are dots; the rolling average is a line. Nothing is interpolated between entries. */
export function LineChart({ points, band, title, unit, summary }: Props) {
  if (points.length === 0) {
    return <p className="helper">{summary}</p>
  }
  const values = points.flatMap((p) => [p.value, ...(p.avg !== undefined ? [p.avg] : [])])
  if (band) values.push(band.min, band.max)
  const lo = Math.floor(Math.min(...values) - 0.5)
  const hi = Math.ceil(Math.max(...values) + 0.5)
  const first = points[0].date
  const span = Math.max(1, daysBetween(first, points[points.length - 1].date))
  const x = (d: DateKey) => PAD.left + (daysBetween(first, d) / span) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const avgPoints = points.filter((p) => p.avg !== undefined)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} focusable="false">
        {band && (
          <rect
            className="chart-band"
            x={PAD.left}
            width={W - PAD.left - PAD.right}
            y={y(band.max)}
            height={Math.max(0, y(band.min) - y(band.max))}
          />
        )}
        <line
          className="chart-axis"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
        />
        <text
          className="chart-label"
          x={PAD.left - 4}
          y={y(hi)}
          textAnchor="end"
          dominantBaseline="hanging"
        >
          {hi}
        </text>
        <text className="chart-label" x={PAD.left - 4} y={y(lo)} textAnchor="end">
          {lo}
        </text>
        {avgPoints.length > 1 && (
          <polyline
            className="chart-line"
            fill="none"
            points={avgPoints.map((p) => `${x(p.date)},${y(p.avg!)}`).join(' ')}
          />
        )}
        {points.map((p) => (
          <circle key={p.date} className="chart-dot" cx={x(p.date)} cy={y(p.value)} r={3} />
        ))}
        <text className="chart-label" x={PAD.left} y={H - 8}>
          {first.slice(5)}
        </text>
        <text className="chart-label" x={W - PAD.right} y={H - 8} textAnchor="end">
          {points[points.length - 1].date.slice(5)}
        </text>
      </svg>
      <figcaption className="helper">
        {summary} ({unit})
      </figcaption>
    </figure>
  )
}
