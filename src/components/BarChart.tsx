export type BarDatum = { label: string; value: number; marker?: number }

type Props = {
  data: readonly BarDatum[]
  unit: string
  /** Plain-language summary for screen readers, always shown below the chart. */
  summary: string
  title: string
}

const WIDTH = 320
const HEIGHT = 150
const PAD = { top: 18, bottom: 26, left: 8, right: 8 }

/** Simple SVG bar chart. Empty data shows a hint instead of an empty frame. */
export function BarChart({ data, unit, summary, title }: Props) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.marker ?? 0)))
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, data.length)
  const barW = Math.min(28, slot * 0.6)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title} focusable="false">
        {data.map((d, i) => {
          const h = (d.value / max) * plotH
          const x = PAD.left + i * slot + (slot - barW) / 2
          const y = PAD.top + plotH - h
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                className="bar"
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.value > 0 ? 1 : 0)}
                rx={3}
              />
              {d.marker !== undefined && (
                <line
                  className="bar-marker"
                  x1={x - 3}
                  x2={x + barW + 3}
                  y1={PAD.top + plotH - (d.marker / max) * plotH}
                  y2={PAD.top + plotH - (d.marker / max) * plotH}
                />
              )}
              <text className="chart-value" x={x + barW / 2} y={y - 4} textAnchor="middle">
                {d.value > 0 ? d.value : ''}
              </text>
              <text className="chart-label" x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle">
                {d.label}
              </text>
            </g>
          )
        })}
        <line
          className="chart-axis"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
        />
      </svg>
      <figcaption className="helper">
        {summary} ({unit})
      </figcaption>
    </figure>
  )
}
