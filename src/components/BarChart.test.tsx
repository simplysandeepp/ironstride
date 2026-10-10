import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart.tsx'

describe('BarChart', () => {
  it('renders an accessible chart with a text summary', () => {
    render(
      <BarChart
        title="Weekly km"
        unit="km"
        summary="Two weeks logged"
        data={[
          { label: 'a', value: 5 },
          { label: 'b', value: 10 },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Weekly km' })).toBeInTheDocument()
    expect(screen.getByText(/two weeks logged \(km\)/i)).toBeInTheDocument()
    expect(document.querySelectorAll('rect.bar')).toHaveLength(2)
  })

  it('does not draw values for empty weeks and survives no data', () => {
    const { container } = render(<BarChart title="t" unit="km" summary="none" data={[]} />)
    expect(container.querySelectorAll('rect.bar')).toHaveLength(0)
  })
})
