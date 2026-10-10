import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineChart } from './LineChart.tsx'

describe('LineChart', () => {
  it('shows the empty message and no chart when there is no data', () => {
    render(<LineChart points={[]} title="t" unit="kg" summary="Nothing yet" />)
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('draws one dot per real entry, an average line, and the target band', () => {
    const { container } = render(
      <LineChart
        title="Weight"
        unit="kg"
        summary="Latest 67"
        band={{ min: 72, max: 75 }}
        points={[
          { date: '2026-10-01', value: 66 },
          { date: '2026-10-03', value: 66.4, avg: 66.2 },
          { date: '2026-10-06', value: 67, avg: 66.5 },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Weight' })).toBeInTheDocument()
    expect(container.querySelectorAll('circle.chart-dot')).toHaveLength(3)
    expect(container.querySelectorAll('polyline.chart-line')).toHaveLength(1)
    expect(container.querySelectorAll('rect.chart-band')).toHaveLength(1)
  })

  it('handles a single entry without dividing by zero', () => {
    const { container } = render(
      <LineChart title="w" unit="kg" summary="s" points={[{ date: '2026-10-01', value: 66 }]} />,
    )
    expect(container.querySelector('circle')?.getAttribute('cx')).not.toBe('NaN')
  })
})
