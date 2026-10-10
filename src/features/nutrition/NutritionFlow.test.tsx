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

describe('water, supplements and meal ideas', () => {
  it('adds water, shows progress against the target, and undoes the last add', async () => {
    renderNutrition()
    await userEvent.click(await screen.findByRole('button', { name: 'Add 250 ml' }))
    expect(
      await screen.findByText(
        (_, el) => el?.tagName === 'SPAN' && el.textContent?.trim() === '250 / 3000 ml',
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo last' }))
    await waitFor(async () => expect(await repositories.waterEntries.onDate(today)).toHaveLength(0))
  })

  it('logs a supplement as skipped and lets you turn B12 tracking on', async () => {
    renderNutrition()
    await userEvent.selectOptions(await screen.findByLabelText(/creatine monohydrate/i), 'Skipped')
    await waitFor(async () =>
      expect((await repositories.supplementLogs.onDate(today))[0]?.status).toBe('skipped'),
    )

    expect(screen.queryByLabelText(/vitamin b12/i)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /manage supplements/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /track vitamin b12/i }))
    expect(await screen.findByLabelText(/vitamin b12 \(/i)).toBeInTheDocument()
  })

  it('saves a new water target', async () => {
    renderNutrition()
    await userEvent.click(await screen.findByRole('button', { name: /manage supplements/i }))
    const target = screen.getByLabelText(/daily water target/i)
    await userEvent.clear(target)
    await userEvent.type(target, '3500')
    await userEvent.tab()
    await waitFor(async () => expect((await repositories.settings.get()).waterTargetMl).toBe(3500))
  })

  it('shows meal ideas and lets you hide and restore them', async () => {
    renderNutrition()
    expect(await screen.findByText(/oats, fortified soy milk/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hide meal ideas' }))
    await waitFor(() => expect(screen.queryByText(/oats, fortified soy milk/i)).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Show meal ideas' }))
    expect(await screen.findByText(/oats, fortified soy milk/i)).toBeInTheDocument()
  })
})

describe('body weight', () => {
  it('saves a weight, replaces it when corrected on the same day, and deletes it', async () => {
    renderNutrition()
    await userEvent.type(await screen.findByLabelText('Weight (kg)'), '66.4')
    await userEvent.click(screen.getByRole('button', { name: 'Save measurement' }))
    await waitFor(async () => expect(await repositories.bodyMeasurements.all()).toHaveLength(1))

    const weight = await screen.findByLabelText('Weight (kg)')
    await userEvent.clear(weight)
    await userEvent.type(weight, '66.9')
    await userEvent.click(screen.getByRole('button', { name: 'Save measurement' }))
    await waitFor(async () =>
      expect((await repositories.bodyMeasurements.all())[0].weightKg).toBe(66.9),
    )
    expect(await repositories.bodyMeasurements.all()).toHaveLength(1)
    expect(await screen.findByText(/latest 66.9 kg/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /delete measurement/i }))
    await waitFor(async () => expect(await repositories.bodyMeasurements.all()).toHaveLength(0))
  })

  it('shows an explanation instead of a chart when nothing is logged, and rejects bad values', async () => {
    renderNutrition()
    expect(await screen.findByText(/no weight logged yet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save measurement' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(/weight or your waist/i)
    expect(await repositories.bodyMeasurements.all()).toHaveLength(0)
  })
})
