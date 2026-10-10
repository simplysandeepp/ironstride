import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { getPlannedRestDays, monthLabels } from './progressModel.ts'
import { ProgressScreen } from './ProgressScreen.tsx'

const START = '2026-10-12'
const TODAY = '2026-10-18' // Sunday of week 1

beforeEach(async () => {
  await repositories.profile.save(
    toProfile(
      { ...defaultProfileValues(START), trainingStartDate: START },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
})

const renderProgress = () =>
  render(
    <MemoryRouter>
      <ProgressScreen today={TODAY} />
    </MemoryRouter>,
  )

describe('progress model', () => {
  it('finds planned rest days only inside the programme', () => {
    const rest = getPlannedRestDays(DEFAULT_PROGRAMME, START, [
      '2026-10-11',
      '2026-10-12',
      '2026-10-18',
    ])
    expect([...rest]).toEqual(['2026-10-18'])
  })

  it('labels the first column of each month once', () => {
    const col = (date: string) => [{ date }, null]
    expect(monthLabels([col('2026-09-28'), col('2026-10-05'), col('2026-10-12')])).toEqual([
      'Sep',
      'Oct',
      '',
    ])
  })
})

describe('ProgressScreen', () => {
  it('shows an empty heatmap with an explanation and 365 days of cells', async () => {
    renderProgress()
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument()
    const group = screen.getByRole('group', { name: /activity heatmap/i })
    expect(within(group).getAllByRole('button')).toHaveLength(365)
    expect(screen.getByText(/dashed = planned rest day/i)).toBeInTheDocument()
  })

  it('reflects real logs in cells, filters, and streaks without mixing gym and runs', async () => {
    await repositories.runLogs.save({
      id: 'r',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 5,
      completed: true,
      plannedWorkoutId: 'w1-d1-run',
    })
    renderProgress()
    const cell = await screen.findByRole('button', { name: /monday 12 october, 1 run, no gym/i })
    expect(cell.className).toContain('hm-2')

    await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
    expect(
      screen.getByRole('button', { name: /monday 12 october, 1 run, no gym/i }).className,
    ).toContain('hm-0')
    await userEvent.click(screen.getByRole('button', { name: 'Runs' }))
    expect(
      screen.getByRole('button', { name: /monday 12 october, 1 run, no gym/i }).className,
    ).toContain('hm-2')

    const streaks = screen.getByRole('region', { name: 'Streaks' })
    expect(within(streaks).getByText(/gym streak · best 0/i)).toBeInTheDocument()
    expect(within(streaks).getByText(/run streak · best 1/i)).toBeInTheDocument()
  })

  it('opens a day summary when a cell is chosen and labels planned rest days', async () => {
    await repositories.runLogs.save({
      id: 'r',
      date: '2026-10-12',
      type: 'long',
      actualDistanceKm: 11,
      completed: true,
    })
    renderProgress()
    await userEvent.click(await screen.findByRole('button', { name: /monday 12 october/i }))
    const summary = screen.getByRole('heading', { name: /monday 12 october/i })
    expect(summary).toBeInTheDocument()
    const daySection = summary.closest('section') as HTMLElement
    expect(within(daySection).getByText(/run:/i).parentElement).toHaveTextContent(
      '11 km · Long run',
    )
    expect(within(daySection).getByText(/planned: upper a, easy run/i)).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /sunday 18 october.*planned rest day/i }),
    )
    expect(screen.getByText(/planned rest day\. recovery is part of training/i)).toBeInTheDocument()
  })

  it('explains how streaks work', async () => {
    renderProgress()
    expect(await screen.findByText(/planned rest days never break it/i)).toBeInTheDocument()
  })
})

const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))

describe('ProgressScreen charts', () => {
  it('explains empty charts instead of drawing fake data', async () => {
    renderProgress()
    expect(await screen.findByText(/week 1 of 26/i)).toBeInTheDocument()
    await openTab('Run')
    expect(await screen.findByText(/no runs logged yet\. log a run/i)).toBeInTheDocument()
    await openTab('Strength')
    expect(await screen.findByText(/finish a workout with weights logged/i)).toBeInTheDocument()
    await openTab('Fuel')
    expect(await screen.findByText(/no weight logged yet/i)).toBeInTheDocument()
  })

  it('summarises real runs, weights and lifts on their own tabs', async () => {
    await repositories.runLogs.save({
      id: 'r',
      date: '2026-10-17',
      type: 'long',
      actualDistanceKm: 8,
      completed: true,
    })
    await repositories.bodyMeasurements.save({ id: 'b', date: '2026-10-17', weightKg: 66.5 })
    await repositories.gymSessions.save({
      id: 'g',
      date: '2026-10-12',
      title: 'Upper A',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'bench-press',
          exerciseNameSnapshot: 'Barbell bench press',
          sets: [{ id: 's', setNumber: 1, loadKg: 40, reps: 8, completed: true }],
        },
      ],
    })
    renderProgress()
    await openTab('Run')
    expect(await screen.findByText(/longest in the last 8 weeks: 8 km/i)).toBeInTheDocument()
    await openTab('Fuel')
    expect(
      await screen.findByText(/latest 66.5 kg\. weight gain is not all muscle/i),
    ).toBeInTheDocument()
    await openTab('Strength')
    expect(await screen.findByLabelText('Exercise')).toHaveValue('bench-press')
    expect(screen.getByText(/latest 40 kg after 1 session/i)).toBeInTheDocument()
  })
})

describe('Dashboard tabs', () => {
  it('shows the four sections, with Overview selected first', async () => {
    renderProgress()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Run', 'Strength', 'Fuel'])
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument()
  })

  it('moves between tabs with the arrow keys, Home and End, keeping only the active tab focusable', async () => {
    renderProgress()
    const overview = await screen.findByRole('tab', { name: 'Overview' })
    overview.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Run' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Run' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Fuel' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Fuel' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the tab named in the link', async () => {
    render(
      <MemoryRouter initialEntries={['/progress?tab=strength']}>
        <ProgressScreen today={TODAY} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('tab', { name: 'Strength' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('ignores an unknown tab name', async () => {
    render(
      <MemoryRouter initialEntries={['/progress?tab=nonsense']}>
        <ProgressScreen today={TODAY} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

describe('Dashboard overview', () => {
  it('shows headline numbers and an honest empty state for insights', async () => {
    renderProgress()
    const keys = await screen.findByRole('region', { name: 'Key numbers' })
    for (const label of [
      'Running this week',
      'Gym this week',
      'Plan consistency',
      'Calories a day',
      'Protein a day',
      'Body weight',
    ]) {
      expect(within(keys).getByText(label)).toBeInTheDocument()
    }
    expect(within(keys).getByText(/shows after a few logged sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing to flag yet/i)).toBeInTheDocument()
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument()
  })

  it('fills the headline numbers from real logs', async () => {
    await repositories.runLogs.save({
      id: 'r1',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
      plannedWorkoutId: 'w1-d1-run',
    })
    await repositories.runLogs.save({
      id: 'r2',
      date: '2026-10-15',
      type: 'tempo',
      actualDistanceKm: 5,
      completed: true,
      plannedWorkoutId: 'w1-d4-run',
    })
    await repositories.foodEntries.save({
      id: 'f',
      date: '2026-10-17',
      meal: 'lunch',
      name: 'x',
      quantity: 1,
      unit: 'g',
      caloriesKcal: 2500,
      proteinG: 120,
      carbsG: 0,
      fatG: 0,
    })
    await repositories.nutritionTargets.save({
      caloriesKcal: 2700,
      proteinG: 130,
      carbsG: 388,
      fatG: 69,
      effectiveFrom: '2026-10-01',
    })
    renderProgress()
    const keys = await screen.findByRole('region', { name: 'Key numbers' })
    expect(within(keys).getByText('9')).toBeInTheDocument()
    expect(within(keys).getByText(/of 19 planned/i)).toBeInTheDocument()
    expect(within(keys).getByText('2,500')).toBeInTheDocument()
    expect(within(keys).getByText(/target 2700/i)).toBeInTheDocument()
    expect(within(keys).getByText('120')).toBeInTheDocument()
  })

  it('compares this week with last week using words as well as arrows', async () => {
    await repositories.runLogs.save({
      id: 'a',
      date: '2026-10-07',
      type: 'easy',
      actualDistanceKm: 5,
      completed: true,
    })
    await repositories.runLogs.save({
      id: 'b',
      date: '2026-10-14',
      type: 'easy',
      actualDistanceKm: 8,
      completed: true,
    })
    render(
      <MemoryRouter>
        <ProgressScreen today="2026-10-15" />
      </MemoryRouter>,
    )
    const compare = (
      await screen.findByRole('heading', { name: 'This week vs last week' })
    ).closest('section') as HTMLElement
    expect(within(compare).getByText('Running')).toBeInTheDocument()
    expect(within(compare).getAllByText('up').length).toBeGreaterThan(0) // screen-reader word for the arrow
    expect(within(compare).getAllByText(/last week: 5 km/i).length).toBeGreaterThan(0)
  })

  it('shows insights, most important first, and a toggle when there are many', async () => {
    const history = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map((d, i) => ({
      id: `h${i}`,
      date: d,
      type: 'easy' as const,
      actualDistanceKm: 10,
      completed: true,
    }))
    await Promise.all(
      [
        ...history,
        {
          id: 'spike',
          date: '2026-10-29',
          type: 'easy' as const,
          actualDistanceKm: 16,
          completed: true,
        },
      ].map((r) => repositories.runLogs.save(r)),
    )
    render(
      <MemoryRouter>
        <ProgressScreen today="2026-10-31" />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Running load jumped')).toBeInTheDocument()
    expect(screen.getAllByText('Heads up').length).toBeGreaterThan(0)
  })

  it('puts each insight on the tab for its area', async () => {
    const history = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map((d, i) => ({
      id: `h${i}`,
      date: d,
      type: 'easy' as const,
      actualDistanceKm: 10,
      completed: true,
    }))
    await Promise.all(
      [
        ...history,
        {
          id: 'spike',
          date: '2026-10-29',
          type: 'easy' as const,
          actualDistanceKm: 16,
          completed: true,
        },
      ].map((r) => repositories.runLogs.save(r)),
    )
    render(
      <MemoryRouter initialEntries={['/progress?tab=run']}>
        <ProgressScreen today="2026-10-31" />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Running load jumped')).toBeInTheDocument()
    await openTab('Strength')
    expect(screen.queryByText('Running load jumped')).toBeNull()
  })
})
