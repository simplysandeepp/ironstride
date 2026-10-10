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

  it('shows only the explanation when there is nothing to plot', () => {
    const { container } = render(<BarChart title="t" unit="km" summary="none yet" data={[]} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.getByText('none yet')).toBeInTheDocument()
    const zeros = render(
      <BarChart title="t" unit="km" summary="all zero" data={[{ label: 'a', value: 0 }]} />,
    )
    expect(zeros.container.querySelector('svg')).toBeNull()
  })

  it('still draws when only a planned marker exists', () => {
    const { container } = render(
      <BarChart title="t" unit="km" summary="s" data={[{ label: 'a', value: 0, marker: 3 }]} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
