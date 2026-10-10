import { useEffect, useRef } from 'react'
import { formatDateLong, type DateKey } from '../../domain/dates.ts'
import { describeHeatmapCell, type HeatmapCell } from '../../domain/heatmap.ts'
import { monthLabels } from './progressModel.ts'

type Props = {
  columns: readonly (readonly (HeatmapCell | null)[])[]
  selected?: DateKey
  restDays: ReadonlySet<DateKey>
  onSelect: (date: DateKey) => void
}

export function Heatmap({ columns, selected, restDays, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const labels = monthLabels(columns)

  // Start scrolled to today, the right-hand edge.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  return (
    <div>
      <div
        className="heatmap-scroll"
        ref={scroller}
        role="group"
        aria-label="Activity heatmap, last 365 days"
      >
        <div className="heatmap">
          <div className="heatmap-months" aria-hidden="true">
            {labels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="heatmap-grid">
            {columns.map((col, c) => (
              <div className="heatmap-col" key={c}>
                {col.map((cell, r) =>
                  cell ? (
                    <button
                      key={cell.date}
                      type="button"
                      className={`hm-cell hm-${cell.intensity}`}
                      data-rest={restDays.has(cell.date) ? 'true' : undefined}
                      aria-pressed={selected === cell.date}
                      aria-label={`${formatDateLong(cell.date)}, ${describeHeatmapCell(cell).split(': ')[1]}${restDays.has(cell.date) ? ', planned rest day' : ''}`}
                      onClick={() => onSelect(cell.date)}
                    />
                  ) : (
                    <span key={r} className="hm-empty" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`hm-cell hm-${i}`} />
        ))}
        <span>More</span>
        <span className="helper">Dashed = planned rest day</span>
      </div>
    </div>
  )
}
