import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { HorizontalBars } from '../../components/HorizontalBars.tsx'
import { repositories } from '../../db/repositories.ts'
import type { GymSession } from '../../domain/types.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { ProgressScreen } from './ProgressScreen.tsx'

describe('HorizontalBars', () => {
  it('puts every number in text and sizes bars against the largest value', () => {
    const { container } = render(
      <HorizontalBars
        rows={[
          { label: 'Chest', value: 10, marker: 8, unit: 'sets' },
          { label: 'Back', value: 5, unit: 'sets' },
        ]}
        markerLabel="average"
      />,
    )
    expect(screen.getByText('Chest').closest('li')).toHaveTextContent('10 sets')
    expect(screen.getByText(/average 8/)).toBeInTheDocument()
    const fills = container.querySelectorAll('.hbar-fill')
    expect(fills[0]).toHaveStyle({ width: '100%' })
    expect(fills[1]).toHaveStyle({ width: '50%' })
  })

  it('does not divide by zero when every value is 0', () => {
    const { container } = render(<HorizontalBars rows={[{ label: 'Calves', value: 0 }]} />)
    expect(container.querySelector('.hbar-fill')).toHaveStyle({ width: '0%' })
  })
})

const session = (
  date: string,
  kg: number,
  reps: number[],
  over: Partial<GymSession> = {},
): GymSession => ({
  id: `g-${date}`,
  date,
  title: 'Upper A',
  status: 'completed',
  startedAt: `${date}T07:00:00.000Z`,
  finishedAt: `${date}T07:50:00.000Z`,
  exercises: [
    {
      exerciseId: 'bench-press',
      exerciseNameSnapshot: 'Barbell bench press',
      sets: reps.map((r, i) => ({
        id: `${date}-${i}`,
        setNumber: i + 1,
        loadKg: kg,
        reps: r,
        completed: true,
      })),
    },
  ],
  ...over,
})

describe('Strength tab detail', () => {
  beforeEach(async () => {
    await repositories.profile.save(
      toProfile(
        { ...defaultProfileValues('2026-10-05'), trainingStartDate: '2026-10-05' },
        undefined,
        '2026-10-01T00:00:00Z',
      ),
    )
  })

  const renderStrength = () =>
    render(
      <MemoryRouter initialEntries={['/progress?tab=strength']}>
        <ProgressScreen today="2026-10-31" />
      </MemoryRouter>,
    )

  it('explains each card when there are no workouts', async () => {
    renderStrength()
    expect(await screen.findByText(/best lifts appear here/i)).toBeInTheDocument()
    expect(screen.getByText(/weekly sets for each muscle group appear here/i)).toBeInTheDocument()
    expect(screen.getByText(/your weekly volume appears here/i)).toBeInTheDocument()
  })

  it('shows personal bests with a New badge only for a fresh record', async () => {
    await Promise.all([
      repositories.gymSessions.save(session('2026-10-12', 40, [8, 8])),
      repositories.gymSessions.save(session('2026-10-19', 42.5, [8, 8])),
      repositories.gymSessions.save(session('2026-10-29', 45, [8, 8])),
    ])
    renderStrength()
    const prs = (await screen.findByRole('heading', { name: 'Personal bests' })).closest(
      'section',
    ) as HTMLElement
    expect(within(prs).getByText('Barbell bench press')).toBeInTheDocument()
    expect(within(prs).getByText('New')).toBeInTheDocument()
    expect(within(prs).getByText(/about 57 kg/)).toBeInTheDocument()
    expect(within(prs).getByText(/45 kg x 8 on 29 Oct · 3 sessions/)).toBeInTheDocument()
    expect(within(prs).getByText(/not a test/i)).toBeInTheDocument()
  })

  it('does not call a first-ever session a new best', async () => {
    await repositories.gymSessions.save(session('2026-10-29', 45, [8, 8]))
    renderStrength()
    const prs = (await screen.findByRole('heading', { name: 'Personal bests' })).closest(
      'section',
    ) as HTMLElement
    expect(within(prs).queryByText('New')).toBeNull()
  })

  it('credits sets to muscle groups and shows volume and session stats', async () => {
    await repositories.gymSessions.save(session('2026-10-29', 40, [10, 10, 10]))
    renderStrength()
    const muscles = (
      await screen.findByRole('heading', { name: 'Hard sets per muscle group' })
    ).closest('section') as HTMLElement
    expect(within(muscles).getByText('Chest').closest('li')).toHaveTextContent('3 sets')
    expect(within(muscles).getByText('Arms').closest('li')).toHaveTextContent('1.5 sets')
    const volume = screen
      .getByRole('heading', { name: 'Training volume' })
      .closest('section') as HTMLElement
    expect(within(volume).getByText(/1,200/)).toBeInTheDocument()
    expect(within(volume).getByText('Average session').closest('.stat')).toHaveTextContent('50 min')
  })

  it('lists only the best five lifts until asked for more', async () => {
    const lifts = [
      'bench-press',
      'lat-pulldown',
      'leg-press',
      'romanian-deadlift',
      'hip-thrust',
      'calf-raise',
    ]
    await repositories.gymSessions.save({
      id: 'many',
      date: '2026-10-29',
      title: 'x',
      status: 'completed',
      exercises: lifts.map((id) => ({
        exerciseId: id,
        exerciseNameSnapshot: id,
        sets: [{ id: id + 'a', setNumber: 1, loadKg: 50, reps: 8, completed: true }],
      })),
    })
    renderStrength()
    const prs = (await screen.findByRole('heading', { name: 'Personal bests' })).closest(
      'section',
    ) as HTMLElement
    expect(within(prs).getAllByRole('listitem')).toHaveLength(5)
    await userEvent.click(within(prs).getByRole('button', { name: 'Show all 6' }))
    expect(within(prs).getAllByRole('listitem')).toHaveLength(6)
  })
})
