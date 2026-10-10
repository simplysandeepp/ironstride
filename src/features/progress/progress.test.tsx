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
    expect(screen.getByText(/run:/i).parentElement).toHaveTextContent('11 km · Long run')
    expect(screen.getByText(/planned: upper a, easy run/i)).toBeInTheDocument()

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
