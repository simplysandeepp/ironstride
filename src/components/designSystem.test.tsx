import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { domainForPath, NAV_ITEMS } from '../app/navigation.ts'
import { LoadingCard } from './LoadingCard.tsx'
import { ProgressBar } from './ProgressBar.tsx'

describe('ProgressBar', () => {
  it('exposes its value to assistive tech and sizes the fill', () => {
    render(<ProgressBar label="Protein progress" value={65} max={130} tone="nutrition" />)
    const bar = screen.getByRole('progressbar', { name: 'Protein progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '65')
    expect(bar).toHaveAttribute('aria-valuemax', '130')
    expect(bar.firstElementChild).toHaveStyle({ width: '50%' })
  })

  it('shows a full bar, not an overflow, when over the target', () => {
    render(<ProgressBar label="Calories progress" value={3000} max={2700} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '2700')
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' })
  })

  it('handles an empty or missing target without NaN', () => {
    render(<ProgressBar label="x" value={5} max={0} />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' })
  })
})

describe('LoadingCard', () => {
  it('announces loading to screen readers', () => {
    render(<LoadingCard label="Reading your plan" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Reading your plan')).toBeInTheDocument()
  })
})

describe('colour areas', () => {
  it('maps every route to one area, shared with its nav item', () => {
    expect(domainForPath('/')).toBe('brand')
    expect(domainForPath('/gym/session/abc')).toBe('gym')
    expect(domainForPath('/run/log')).toBe('run')
    expect(domainForPath('/nutrition/food')).toBe('nutrition')
    expect(domainForPath('/progress')).toBe('body')
    expect(domainForPath('/plan')).toBe('brand')
    for (const item of NAV_ITEMS) expect(domainForPath(item.path)).toBe(item.domain)
  })
})
