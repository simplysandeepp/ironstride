import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { LoadGauge } from '../../components/LoadGauge.tsx'
import { StackedBar } from '../../components/StackedBar.tsx'
import { StatList } from '../../components/StatList.tsx'
import { repositories } from '../../db/repositories.ts'
import { getLoadRamp } from '../../domain/insights/runInsights.ts'
import type { RunLog } from '../../domain/types.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { ProgressScreen } from './ProgressScreen.tsx'

const run = (date: string, km: number, over: Partial<RunLog> = {}): RunLog => ({
  id: `${date}-${km}-${over.type ?? 'easy'}`,
  date,
  type: 'easy',
  actualDistanceKm: km,
  completed: true,
  ...over,
})
const paced = (date: string, km: number, sec: number, over: Partial<RunLog> = {}) =>
  run(date, km, { durationSeconds: km * sec, averagePaceSecondsPerKm: sec, ...over })

describe('LoadGauge', () => {
  it('describes the reading in words and places a marker', () => {
    const history = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map((d) => run(d, 10))
    const ramp = getLoadRamp([...history, run('2026-10-29', 16)], '2026-10-31')
    const { container } = render(<LoadGauge ramp={ramp} />)
    expect(
      screen.getByRole('img', {
        name: /16 km in the last 7 days against an average week of 10 km: 1.6x, spike/i,
      }),
    ).toBeInTheDocument()
    expect(container.querySelector('.gauge-marker')).toHaveStyle({ left: '80%' })
  })

  it('says so when there is not enough history and draws no marker', () => {
    const { container } = render(<LoadGauge ramp={getLoadRamp([], '2026-10-31')} />)
    expect(screen.getAllByText(/not enough running history/i).length).toBeGreaterThan(0)
    expect(container.querySelector('.gauge-marker')).toBeNull()
  })
})

describe('StackedBar and StatList', () => {
  it('shows each part with its share, so colour is never the only cue', () => {
    render(
      <StackedBar
        ariaLabel="Mix"
        segments={[
          { label: 'Easy', value: 30, tone: 'run' },
          { label: 'Hard', value: 10, tone: 'body' },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Mix' })).toBeInTheDocument()
    expect(screen.getByText('Easy').parentElement).toHaveTextContent('Easy 75%')
    expect(screen.getByText('Hard').parentElement).toHaveTextContent('Hard 25%')
  })

  it('draws nothing when there is no data', () => {
    const { container } = render(
      <StackedBar ariaLabel="x" segments={[{ label: 'a', value: 0, tone: 'run' }]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists labelled values with optional hints', () => {
    render(<StatList stats={[{ label: 'Longest run', value: '12 km', hint: '12 Oct' }]} />)
    expect(screen.getByText('Longest run')).toBeInTheDocument()
    expect(screen.getByText('12 km')).toBeInTheDocument()
    expect(screen.getByText('12 Oct')).toBeInTheDocument()
  })
})

describe('Run tab detail', () => {
  beforeEach(async () => {
    await repositories.profile.save(
      toProfile(
        { ...defaultProfileValues('2026-10-05'), trainingStartDate: '2026-10-05' },
        undefined,
        '2026-10-01T00:00:00Z',
      ),
    )
  })

  const renderRun = (today = '2026-10-31') =>
    render(
      <MemoryRouter initialEntries={['/progress?tab=run']}>
        <ProgressScreen today={today} />
      </MemoryRouter>,
    )

  it('explains each card when there is no running data yet', async () => {
    renderRun()
    const load = (await screen.findByRole('heading', { name: 'Training load' })).closest(
      'section',
    ) as HTMLElement
    expect(within(load).getAllByText(/not enough running history/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/split between easy and hard running appears here/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/add a time when you log runs/i)).toBeInTheDocument()
    const bests = screen
      .getByRole('heading', { name: 'Personal bests and totals' })
      .closest('section') as HTMLElement
    expect(within(bests).getByText('Longest run').closest('.stat')).toHaveTextContent('—')
  })

  it('shows load, mix, pace and bests from real runs', async () => {
    const runs = [
      paced('2026-10-06', 5, 372, { rpe: 4 }),
      paced('2026-10-08', 5, 372, { rpe: 4 }),
      paced('2026-10-13', 5, 372, { rpe: 3 }),
      paced('2026-10-17', 8, 380, { type: 'long', rpe: 5 }),
      paced('2026-10-20', 5, 355, { rpe: 4 }),
      paced('2026-10-22', 4, 320, { type: 'interval' }),
      paced('2026-10-27', 5, 352, { rpe: 4 }),
      paced('2026-10-29', 5, 340, { type: 'tempo' }),
    ]
    await Promise.all(runs.map((r) => repositories.runLogs.save(r)))
    renderRun()
    expect(
      await screen.findByRole('img', { name: /last 7 days against an average week/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /easy, .* hard, by distance/i })).toBeInTheDocument()
    expect(screen.getByText(/your plan asks for about \d+% easy/i)).toBeInTheDocument()
    expect(screen.getByText(/pace is faster/i)).toBeInTheDocument()
    const bests = screen
      .getByRole('heading', { name: 'Personal bests and totals' })
      .closest('section') as HTMLElement
    expect(within(bests).getByText('Longest run').closest('.stat')).toHaveTextContent('8 km')
    expect(
      within(bests)
        .getByText(/fastest pace/i)
        .closest('.stat'),
    ).toHaveTextContent('5:20 /km')
    expect(within(bests).getByText('All runs logged').closest('.stat')).toHaveTextContent(
      '8 runs, 42 km',
    )
  })

  it('keeps the other tabs free of running detail', async () => {
    renderRun()
    await userEvent.click(await screen.findByRole('tab', { name: 'Strength' }))
    expect(screen.queryByRole('heading', { name: 'Training load' })).toBeNull()
  })
})
