import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { repositories } from '../db/repositories.ts'
import { defaultProfileValues, toProfile } from '../features/settings/profileValues.ts'
import { expectNoA11yViolations } from './a11y.ts'

const START = '2026-10-12'

async function seed() {
  await repositories.profile.save(
    toProfile(
      { ...defaultProfileValues(START), trainingStartDate: START },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
  await repositories.settings.save({
    ...(await repositories.settings.get()),
    onboardingCompleted: true,
  })
  await repositories.runLogs.save({
    id: 'r',
    date: START,
    type: 'easy',
    actualDistanceKm: 4,
    completed: true,
  })
  await repositories.foodEntries.save({
    id: 'f',
    date: START,
    meal: 'breakfast',
    name: 'Oats',
    quantity: 40,
    unit: 'g',
    caloriesKcal: 150,
    proteinG: 5,
    carbsG: 27,
    fatG: 3,
  })
  await repositories.bodyMeasurements.save({ id: 'b', date: START, weightKg: 66.4 })
}

const open = async (path: string, ready: string | RegExp) => {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: ready })
  return view
}

describe('accessibility: every screen has a sound structure', () => {
  beforeEach(seed)

  for (const [path, heading] of [
    ['/', 'Today'],
    ['/gym', 'Gym'],
    ['/run', 'Run'],
    ['/run/log', 'Log run'],
    ['/nutrition', 'Nutrition'],
    ['/nutrition/food', 'Add food'],
    ['/progress', 'Progress'],
    ['/plan', 'Full plan'],
    ['/settings', 'Settings'],
  ] as const) {
    it(`${path} has no violations`, async () => {
      const { container } = await open(path, heading)
      // Let live queries settle so the audit sees the real content, not a loading state.
      await new Promise((r) => setTimeout(r, 150))
      await expectNoA11yViolations(container)
    })
  }

  it('onboarding has no violations', async () => {
    await repositories.settings.save({
      ...(await repositories.settings.get()),
      onboardingCompleted: false,
    })
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Welcome to IronStride' })
    await expectNoA11yViolations(container)
  })

  it('an open confirmation dialog has no violations and moves focus to the safe choice', async () => {
    await repositories.gymSessions.save({
      id: 'sess',
      date: START,
      title: 'Upper A',
      status: 'in-progress',
      exercises: [
        {
          exerciseId: 'bench-press',
          exerciseNameSnapshot: 'Barbell bench press',
          sets: [{ id: 's1', setNumber: 1, completed: false }],
        },
      ],
    })
    await open('/gym/session/sess', 'Workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Discard workout' }))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Discard this workout?')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await expectNoA11yViolations(document.body)
  })

  it('the interactive controls are all named', async () => {
    const { container } = await open('/progress', 'Progress')
    await new Promise((r) => setTimeout(r, 150))
    const unnamed = [...container.querySelectorAll('button, a, input, select')].filter((el) => {
      const name =
        el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        (el as HTMLInputElement).labels?.[0]?.textContent
      return !name
    })
    expect(unnamed).toHaveLength(0)
  })
})
