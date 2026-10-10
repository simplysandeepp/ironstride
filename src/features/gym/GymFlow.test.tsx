import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { GymScreen } from './GymScreen.tsx'
import { SessionScreen } from './SessionScreen.tsx'

const START = '2026-10-12'

beforeEach(async () => {
  await repositories.profile.save(
    toProfile(
      { ...defaultProfileValues(START), trainingStartDate: START },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
})

function renderGym() {
  return render(
    <MemoryRouter initialEntries={['/gym']}>
      <Routes>
        <Route path="/gym" element={<GymScreen today={START} />} />
        <Route path="/gym/session/:id" element={<SessionScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('gym flow', () => {
  it('shows the next planned workout and this week schedule', async () => {
    renderGym()
    expect(await screen.findByText(/next: upper a/i)).toBeInTheDocument()
    expect(screen.getByText('Lower body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument()
  })

  it('starts once even with repeated taps, logs sets, and completes only on Finish', async () => {
    renderGym()
    const start = await screen.findByRole('button', { name: 'Start workout' })
    await userEvent.dblClick(start)
    expect(await screen.findByRole('heading', { name: 'Upper A' })).toBeInTheDocument()
    expect(await repositories.gymSessions.all()).toHaveLength(1)

    await userEvent.type(screen.getByLabelText(/bench press set 1 load/i), '40')
    await userEvent.type(screen.getByLabelText(/bench press set 1 reps/i), '8')
    await userEvent.click(screen.getByLabelText(/bench press set 1 done/i))

    await waitFor(async () => {
      const [s] = await repositories.gymSessions.all()
      expect(s.exercises[0].sets[0]).toMatchObject({ loadKg: 40, reps: 8, completed: true })
      expect(s.status).toBe('in-progress')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Finish workout' }))
    expect(await screen.findByText(/all gym sessions|next: lower body/i)).toBeInTheDocument()
    expect((await repositories.gymSessions.all())[0].status).toBe('completed')
  })

  it('will not finish a session with no completed sets', async () => {
    renderGym()
    await userEvent.click(await screen.findByRole('button', { name: 'Start workout' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one set/i)
    expect((await repositories.gymSessions.all())[0].status).toBe('in-progress')
  })

  it('resumes an interrupted session and offers Resume', async () => {
    renderGym()
    await userEvent.click(await screen.findByRole('button', { name: 'Start workout' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByRole('button', { name: 'Resume workout' })).toBeInTheDocument()
    expect(await repositories.gymSessions.all()).toHaveLength(1)
  })

  it('asks before discarding and keeps the session when cancelled', async () => {
    renderGym()
    await userEvent.click(await screen.findByRole('button', { name: 'Start workout' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Discard workout' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await repositories.gymSessions.all()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Discard workout' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(async () => expect(await repositories.gymSessions.all()).toHaveLength(0))
  })
})
