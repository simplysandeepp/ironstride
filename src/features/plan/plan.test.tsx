import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { getWeekRunKm } from '../../domain/programme.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { MAX_RUN_KM, parseDistance } from './planEdit.ts'
import { PlanScreen } from './PlanScreen.tsx'

const START = '2026-10-12'

async function seed(baseline = '18', long = '10') {
  await repositories.profile.save(
    toProfile(
      {
        ...defaultProfileValues(START),
        trainingStartDate: START,
        weeklyRunBaselineKm: baseline,
        recentLongRunKm: long,
      },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
}

const renderPlan = (today = '2026-10-14') =>
  render(
    <MemoryRouter>
      <PlanScreen today={today} />
    </MemoryRouter>,
  )

describe('parseDistance', () => {
  it('reads dots and commas and rounds to 0.1', () => {
    expect(parseDistance('5')).toEqual({ ok: true, km: 5 })
    expect(parseDistance('7,5')).toEqual({ ok: true, km: 7.5 })
    expect(parseDistance('6.04')).toEqual({ ok: true, km: 6 })
  })

  it('rejects blanks, junk and out-of-range values with a reason', () => {
    for (const bad of ['', 'abc', '0', '-2', String(MAX_RUN_KM + 1)]) {
      const r = parseDistance(bad)
      expect(r.ok, bad).toBe(false)
    }
  })
})

describe('PlanScreen', () => {
  beforeEach(() => seed())

  it('lists all 26 weeks with dates, kilometres and recovery weeks', async () => {
    renderPlan()
    expect(await screen.findByText(/your 26-week plan/i)).toBeInTheDocument()
    expect(document.querySelectorAll('details.week')).toHaveLength(26)
    const first = screen.getByText('Week 1').closest('summary') as HTMLElement
    expect(first).toHaveTextContent('from 12 Oct')
    expect(first).toHaveTextContent('19 km')
    expect(screen.getByText('Week 4').closest('summary')).toHaveTextContent('Recovery week')
    expect(screen.getByText('Week 26').closest('summary')).toHaveTextContent('from 5 Apr')
  })

  it('opens the current week and shows the whole week: gym split, runs and rest', async () => {
    renderPlan('2026-10-14')
    const week1 = (await screen.findByText('Week 1')).closest('details') as HTMLElement
    expect(week1).toHaveAttribute('open')
    expect(screen.getByText('Week 2').closest('details')).not.toHaveAttribute('open')
    const view = within(week1)
    expect(view.getByText('Upper A')).toBeInTheDocument()
    expect(view.getByText('Lower body')).toBeInTheDocument()
    expect(view.getByText('Upper B + posterior chain')).toBeInTheDocument()
    expect(view.getByText('Easy run')).toBeInTheDocument()
    expect(view.getByText(/intervals: 6 × 400 m/i, { selector: 'strong' })).toBeInTheDocument()
    expect(view.getByText(/tempo: 2 × 8 min/i, { selector: 'strong' })).toBeInTheDocument()
    expect(view.getByText('Long run')).toBeInTheDocument()
    expect(view.getByText('Recovery day')).toBeInTheDocument()
    expect(view.getByText(/barbell bench press 2×6-10/i)).toBeInTheDocument()
  })

  it('edits a run distance, keeps the default untouched, and recalculates the week total', async () => {
    renderPlan()
    const week1 = (await screen.findByText('Week 1')).closest('details') as HTMLElement
    const input = within(week1).getByLabelText(/distance for long run/i)
    await userEvent.clear(input)
    await userEvent.type(input, '9')
    await userEvent.click(
      within(input.closest('li') as HTMLElement).getByRole('button', { name: 'Save distance' }),
    )
    await waitFor(() =>
      expect(screen.getByText('Week 1').closest('summary')).toHaveTextContent('21 km'),
    )
    expect(screen.getByText('Week 1').closest('summary')).toHaveTextContent('Edited')
    expect((await db.plannedOverrides.get('w1-d6-run'))?.plannedDistanceKm).toBe(9)
    expect(getWeekRunKm(DEFAULT_PROGRAMME.weeks[0])).toBe(19)
  })

  it('resets an edited run back to the plan', async () => {
    renderPlan()
    const week1 = (await screen.findByText('Week 1')).closest('details') as HTMLElement
    const input = within(week1).getByLabelText(/distance for long run/i)
    await userEvent.clear(input)
    await userEvent.type(input, '9')
    const item = input.closest('li') as HTMLElement
    await userEvent.click(within(item).getByRole('button', { name: 'Save distance' }))
    await userEvent.click(await within(item).findByRole('button', { name: 'Reset to 7 km' }))
    await waitFor(() =>
      expect(screen.getByText('Week 1').closest('summary')).toHaveTextContent('19 km'),
    )
    expect(await db.plannedOverrides.get('w1-d6-run')).toBeUndefined()
  })

  it('rejects an invalid distance and saves nothing', async () => {
    renderPlan()
    const week1 = (await screen.findByText('Week 1')).closest('details') as HTMLElement
    const input = within(week1).getByLabelText(/distance for easy run/i)
    await userEvent.clear(input)
    await userEvent.type(input, '500')
    await userEvent.click(
      within(input.closest('li') as HTMLElement).getByRole('button', { name: 'Save distance' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/between 0.5 and 60/i)
    expect(await db.plannedOverrides.count()).toBe(0)
  })

  it('offers no distance editor on gym or rest days', async () => {
    renderPlan()
    const week1 = (await screen.findByText('Week 1')).closest('details') as HTMLElement
    expect(within(week1).getAllByRole('button', { name: 'Save distance' })).toHaveLength(4)
  })
})

describe('PlanScreen scaling note', () => {
  it('explains when distances are scaled to a lower base', async () => {
    await seed('12', '8')
    renderPlan()
    expect(await screen.findByText(/scaled to \d+% of the standard plan/i)).toBeInTheDocument()
    expect(screen.getByText('Week 1').closest('summary')).not.toHaveTextContent('19 km')
  })

  it('stays quiet when no scaling is needed', async () => {
    await seed('18', '10')
    renderPlan()
    await screen.findByText(/your 26-week plan/i)
    expect(screen.queryByText(/scaled to/i)).toBeNull()
  })
})
