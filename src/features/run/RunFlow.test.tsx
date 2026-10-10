import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { RunLogScreen } from './RunLogScreen.tsx'
import { RunScreen } from './RunScreen.tsx'

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

const weekTotal = (text: RegExp) =>
  screen.findByText(
    (_, el) => el?.classList.contains('eyebrow') === true && text.test(el.textContent ?? ''),
  )

const renderRun = (path = '/run') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/run" element={<RunScreen today={START} />} />
        <Route path="/run/log" element={<RunLogScreen today={START} />} />
      </Routes>
    </MemoryRouter>,
  )

describe('run flow', () => {
  it('shows the week with planned distances and 0 km done', async () => {
    renderRun()
    expect(await weekTotal(/0 \/ 19 km this week/)).toBeInTheDocument()
    expect(screen.getByText(/intervals: 6 × 400 m/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Log run' })).toHaveLength(4)
  })

  it('logs a planned run with computed pace and marks it done once', async () => {
    renderRun()
    await userEvent.click((await screen.findAllByRole('link', { name: 'Log run' }))[0])
    expect(await screen.findByRole('heading', { name: /log: easy run/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Distance (km)')).toHaveValue('4')

    await userEvent.type(screen.getByLabelText(/time \(optional/i), '24:00')
    expect(screen.getByText(/average pace 6:00/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/effort/i), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Save run' }))

    expect(await weekTotal(/4 \/ 19 km this week/)).toBeInTheDocument()
    const runs = await repositories.runLogs.all()
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      id: 'run-w1-d1-run',
      actualDistanceKm: 4,
      durationSeconds: 1440,
      rpe: 4,
      completed: true,
    })
    expect(screen.getAllByRole('link', { name: 'Log run' })).toHaveLength(3)
  })

  it('rejects an invalid distance and saves nothing', async () => {
    renderRun('/run/log')
    await userEvent.type(await screen.findByLabelText('Distance (km)'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save run' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/greater than 0/i)
    expect(await repositories.runLogs.all()).toHaveLength(0)
  })

  it('logs an unplanned run without linking it to the plan', async () => {
    renderRun('/run/log')
    await userEvent.type(await screen.findByLabelText('Distance (km)'), '3.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save run' }))
    await waitFor(async () => expect(await repositories.runLogs.all()).toHaveLength(1))
    const [run] = await repositories.runLogs.all()
    expect(run.plannedWorkoutId).toBeUndefined()
    expect(run.actualDistanceKm).toBe(3.5)
  })

  it('edits an existing run', async () => {
    await repositories.runLogs.save({
      id: 'x',
      date: START,
      type: 'easy',
      actualDistanceKm: 5,
      completed: true,
    })
    renderRun('/run/log?edit=x')
    const distance = await screen.findByLabelText('Distance (km)')
    await userEvent.clear(distance)
    await userEvent.type(distance, '6')
    await userEvent.click(screen.getByRole('button', { name: 'Save run' }))
    await waitFor(async () =>
      expect((await repositories.runLogs.get('x'))?.actualDistanceKm).toBe(6),
    )
    expect(await repositories.runLogs.all()).toHaveLength(1)
  })
})
