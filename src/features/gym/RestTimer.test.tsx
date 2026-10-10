import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestTimer } from './RestTimer.tsx'

afterEach(() => vi.useRealTimers())

describe('RestTimer', () => {
  it('only starts when asked, counts down, and can be stopped', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<RestTimer seconds={3} />)
    expect(screen.queryByRole('timer')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /start rest timer/i }))
    expect(screen.getByRole('timer')).toHaveTextContent('0:03')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByRole('timer')).toHaveTextContent('0:02')
    await userEvent.click(screen.getByRole('button', { name: 'Stop timer' }))
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('says when rest is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<RestTimer seconds={1} />)
    await userEvent.click(screen.getByRole('button', { name: /start rest timer/i }))
    await act(() => vi.advanceTimersByTimeAsync(1100))
    expect(screen.getByRole('timer')).toHaveTextContent('Rest over')
  })
})
