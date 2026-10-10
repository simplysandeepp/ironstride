import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { TodayScreen } from './TodayScreen.tsx'

const START = '2026-10-12'

async function seedProfile() {
  await repositories.profile.save(
    toProfile(
      { ...defaultProfileValues(START), trainingStartDate: START },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
}

const renderToday = (today: string) =>
  render(
    <MemoryRouter>
      <TodayScreen today={today} />
    </MemoryRouter>,
  )

describe('TodayScreen', () => {
  beforeEach(seedProfile)

  it('asks for setup when there is no profile', async () => {
    await db.profile.clear()
    renderToday(START)
    expect(await screen.findByText('Set up your plan')).toBeInTheDocument()
  })

  it('shows the planned Monday sessions and a start action', async () => {
    renderToday(START)
    expect(await screen.findByText('Upper A')).toBeInTheDocument()
    expect(screen.getByText('Easy run')).toBeInTheDocument()
    expect(screen.getByText(/week 1 of 26/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start workout' })).toHaveAttribute('href', '/gym')
  })

  it('labels Sunday as a recovery day with no start action', async () => {
    renderToday('2026-10-18')
    expect(await screen.findByRole('heading', { name: 'Recovery day' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /start workout|log run/i })).toBeNull()
  })

  it('says the plan has not started yet before the start date', async () => {
    renderToday('2026-10-05')
    expect(await screen.findByText(/your plan starts on/i)).toBeInTheDocument()
  })

  it('toggles a supplement and saves a single record per day', async () => {
    renderToday(START)
    const creatine = await screen.findByRole('checkbox', { name: /creatine/i })
    await userEvent.click(creatine)
    await waitFor(() => expect(creatine).toBeChecked())
    expect(await repositories.supplementLogs.onDate(START)).toHaveLength(1)
    await userEvent.click(creatine)
    await waitFor(() => expect(creatine).not.toBeChecked())
    expect(await repositories.supplementLogs.onDate(START)).toHaveLength(0)
  })

  it('adds water in 250 ml steps', async () => {
    renderToday(START)
    await userEvent.click(await screen.findByRole('button', { name: /add 250 ml water/i }))
    await waitFor(async () => {
      const total = (await repositories.waterEntries.onDate(START)).reduce(
        (s, w) => s + w.amountMl,
        0,
      )
      expect(total).toBe(250)
    })
    expect(await screen.findByText('250')).toBeInTheDocument()
  })
})
