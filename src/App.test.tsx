import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { repositories } from './db/repositories.ts'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function completeOnboarding() {
  await repositories.settings.save({
    ...(await repositories.settings.get()),
    onboardingCompleted: true,
  })
}

describe('onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('shows onboarding first and saves profile, targets and completion', async () => {
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Welcome to IronStride' }),
    ).toBeInTheDocument()

    const weight = screen.getByLabelText(/current weight/i)
    await userEvent.clear(weight)
    await userEvent.type(weight, '67')
    await userEvent.click(screen.getByRole('button', { name: 'Start training' }))

    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect((await repositories.profile.get())?.currentWeightKg).toBe(67)
    expect((await repositories.settings.get()).onboardingCompleted).toBe(true)
    expect(await repositories.nutritionTargets.forDate('9999-12-31')).toMatchObject({
      caloriesKcal: 2700,
      proteinG: 130,
    })
  })

  it('shows field errors without saving invalid values', async () => {
    renderApp()
    const weight = await screen.findByLabelText(/current weight/i)
    await userEvent.clear(weight)
    await userEvent.click(screen.getByRole('button', { name: 'Start training' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/weight should be between/i)
    expect(await repositories.profile.get()).toBeUndefined()
  })

  it('can be skipped and edited later', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect((await repositories.settings.get()).onboardingCompleted).toBe(true)
  })
})

describe('App shell', () => {
  beforeEach(async () => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    await completeOnboarding()
  })

  it('shows the five primary destinations', async () => {
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    for (const label of ['Today', 'Gym', 'Run', 'Nutrition', 'Progress']) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('navigates between screens and marks the current one', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('link', { name: 'Gym' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Gym' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gym' })).toHaveAttribute('aria-current', 'page')
  })

  it('defaults to dark and persists a theme change', async () => {
    renderApp()
    await screen.findByRole('navigation', { name: 'Primary' })
    expect(document.documentElement.dataset.theme).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: /theme: dark/i }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ironstride.theme')).toBe('light')
  })

  it('edits settings and keeps nutrition target history', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('link', { name: 'Settings' }))
    const calories = await screen.findByLabelText(/daily calories/i)
    await userEvent.clear(calories)
    await userEvent.type(calories, '2900')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(async () =>
      expect((await repositories.nutritionTargets.forDate('9999-12-31'))?.caloriesKcal).toBe(2900),
    )
    expect(await repositories.nutritionTargets.forDate('2000-01-01')).toBeUndefined()
  })
})
