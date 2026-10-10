import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { getLocalDateKey } from '../../domain/dates.ts'
import { deriveMacroTargets } from '../../domain/nutrition.ts'
import { FoodFormScreen } from './FoodFormScreen.tsx'
import { NutritionScreen } from './NutritionScreen.tsx'

const today = getLocalDateKey()

beforeEach(async () => {
  await repositories.nutritionTargets.save(deriveMacroTargets(2700, 130, '2000-01-01'))
})

const macro = (text: string) =>
  screen.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent?.trim() === text)

const renderNutrition = (path = '/nutrition') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/nutrition" element={<NutritionScreen />} />
        <Route path="/nutrition/food" element={<FoodFormScreen />} />
      </Routes>
    </MemoryRouter>,
  )

async function fillFood(name: string, kcal: string, protein: string) {
  await userEvent.type(await screen.findByLabelText('Food name'), name)
  await userEvent.clear(screen.getByLabelText('Calories (kcal)'))
  await userEvent.type(screen.getByLabelText('Calories (kcal)'), kcal)
  await userEvent.type(screen.getByLabelText('Protein (g)'), protein)
  await userEvent.type(screen.getByLabelText('Carbohydrates (g)'), '30')
  await userEvent.type(screen.getByLabelText('Fat (g)'), '5')
}

describe('nutrition flow', () => {
  it('starts empty with targets and an explanation', async () => {
    renderNutrition()
    expect(await screen.findByText(/no food logged/i)).toBeInTheDocument()
    expect(await macro('0 / 2700 kcal')).toBeInTheDocument()
  })

  it('adds a food and updates totals from the entries', async () => {
    renderNutrition()
    await userEvent.click(await screen.findByRole('link', { name: 'Add food' }))
    await fillFood('Oats', '300', '10')
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(await macro('300 / 2700 kcal')).toBeInTheDocument()
    expect(screen.getAllByText('Oats').length).toBeGreaterThan(0)
    expect(await repositories.foodEntries.onDate(today)).toHaveLength(1)
  })

  it('rejects negative nutrients and saves nothing', async () => {
    renderNutrition('/nutrition/food')
    await fillFood('Bad', '-5', '10')
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(/0 or more/i)
    expect(await repositories.foodEntries.all()).toHaveLength(0)
  })

  it('quick-adds a sample, copies, edits and deletes, keeping totals in sync', async () => {
    renderNutrition('/nutrition/food?sample=banana')
    expect(await screen.findByText(/rough estimates/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(await macro('105 / 2700 kcal')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Banana' }))
    expect(await macro('210 / 2700 kcal')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Banana' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await macro('105 / 2700 kcal')).toBeInTheDocument()
    expect(await repositories.foodEntries.all()).toHaveLength(1)
  })

  it('adds from recent foods and toggles favourite', async () => {
    await repositories.foodEntries.save({
      id: 'old',
      date: '2026-01-01',
      meal: 'lunch',
      name: 'Dal',
      quantity: 1,
      unit: 'katori',
      caloriesKcal: 150,
      proteinG: 9,
      carbsG: 24,
      fatG: 2,
    })
    renderNutrition()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Dal' }))
    expect(await macro('150 / 2700 kcal')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Favourite Dal' })[0])
    await waitFor(async () =>
      expect(
        // Recent foods are de-duplicated by name, so the newest Dal entry is the one toggled.
        (await repositories.foodEntries.all()).some((e) => e.name === 'Dal' && e.favourite),
      ).toBe(true),
    )
  })

  it('lets you look at a previous day without changing today', async () => {
    await userEvent.setup()
    renderNutrition()
    await userEvent.click(await screen.findByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText(/no food logged/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()
  })
})
