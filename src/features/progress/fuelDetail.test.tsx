import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { addDays } from '../../domain/dates.ts'
import type { FoodEntry } from '../../domain/types.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { ProgressScreen } from './ProgressScreen.tsx'

const TODAY = '2026-10-31'
let n = 0
const food = (
  date: string,
  kcal: number,
  protein: number,
  over: Partial<FoodEntry> = {},
): FoodEntry => ({
  id: `f${++n}`,
  date,
  meal: 'lunch',
  name: 'x',
  quantity: 1,
  unit: 'g',
  caloriesKcal: kcal,
  proteinG: protein,
  carbsG: 300,
  fatG: 70,
  ...over,
})

beforeEach(async () => {
  await repositories.profile.save(
    toProfile(
      { ...defaultProfileValues('2026-10-05'), trainingStartDate: '2026-10-05' },
      undefined,
      '2026-10-01T00:00:00Z',
    ),
  )
  await repositories.nutritionTargets.save({
    caloriesKcal: 2700,
    proteinG: 130,
    carbsG: 388,
    fatG: 69,
    effectiveFrom: '2026-10-01',
  })
})

const renderFuel = () =>
  render(
    <MemoryRouter initialEntries={['/progress?tab=fuel']}>
      <ProgressScreen today={TODAY} />
    </MemoryRouter>,
  )

const card = async (name: string) =>
  (await screen.findByRole('heading', { name })).closest('section') as HTMLElement

describe('Fuel tab detail with no data', () => {
  it('explains every card instead of showing empty charts', async () => {
    renderFuel()
    expect(
      await screen.findByText(/log food and your daily calories appear here/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/your daily protein appears here/i)).toBeInTheDocument()
    expect(screen.getByText(/split of protein, carbs and fat appears here/i)).toBeInTheDocument()
    expect(screen.getAllByText(/morning weight on the nutrition screen/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/needs 10 days of food over 3 weeks/i)).toBeInTheDocument()
    const consistency = await card('Consistency')
    expect(
      within(consistency).getByText('Days with food logged').closest('.stat'),
    ).toHaveTextContent('0 of 7')
    expect(within(consistency).getByText('Creatine').closest('.stat')).toHaveTextContent('—')
  })
})

describe('Fuel tab detail with real logs', () => {
  const week = (kcal: number, protein: number) =>
    Array.from({ length: 7 }, (_, i) =>
      food(addDays(TODAY, -i), kcal, protein, { meal: i % 2 ? 'dinner' : 'lunch' }),
    )

  it('summarises intake against the target and counts the days that hit it', async () => {
    await Promise.all(week(2700, 130).map((f) => repositories.foodEntries.save(f)))
    renderFuel()
    expect(await screen.findByText(/7 of 7 days logged, averaging 2700 kcal/i)).toBeInTheDocument()
    const consistency = await card('Consistency')
    expect(
      within(consistency).getByText('Days with food logged').closest('.stat'),
    ).toHaveTextContent('7 of 7')
    expect(within(consistency).getByText('Protein on target').closest('.stat')).toHaveTextContent(
      '7 of 7 days',
    )
    expect(
      within(consistency).getByText('Calories near target').closest('.stat'),
    ).toHaveTextContent('7 of 7 days')
  })

  it('shows the macro split next to the target split, and protein by meal', async () => {
    await Promise.all(week(2700, 130).map((f) => repositories.foodEntries.save(f)))
    renderFuel()
    expect(
      await screen.findByRole('img', { name: /protein, .*% carbohydrate, .*% fat, by energy/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/your targets work out to 19% protein, 58% carbs and 23% fat/i),
    ).toBeInTheDocument()
    const protein = await card('Protein, last 7 days')
    expect(within(protein).getByText('Dinner')).toBeInTheDocument()
    expect(within(protein).getByText('Lunch')).toBeInTheDocument()
  })

  it('reports creatine and water consistency once they have been logged', async () => {
    const days = Array.from({ length: 6 }, (_, i) => addDays(TODAY, -i))
    await Promise.all(
      days.map((d) =>
        repositories.supplementLogs.save({
          id: `${d}-creatine`,
          date: d,
          supplement: 'creatine',
          amount: 3,
          unit: 'g',
          status: 'taken',
        }),
      ),
    )
    await Promise.all(
      days.map((d) => repositories.waterEntries.save({ id: `w-${d}`, date: d, amountMl: 3000 })),
    )
    renderFuel()
    const consistency = await card('Consistency')
    expect(within(consistency).getByText('Creatine').closest('.stat')).toHaveTextContent(
      '6 of 6 days',
    )
    expect(within(consistency).getByText('Water goal').closest('.stat')).toHaveTextContent(
      '6 of 7 days',
    )
  })

  it('shows weight progress, rate and ETA, and a labelled maintenance estimate', async () => {
    await Promise.all(
      Array.from({ length: 21 }, (_, i) => food(addDays(TODAY, -i), 2900, 120)).map((f) =>
        repositories.foodEntries.save(f),
      ),
    )
    await Promise.all(
      [66, 66.4, 66.8, 67.2].map((kg, i) =>
        repositories.bodyMeasurements.save({
          id: `b${i}`,
          date: addDays('2026-10-05', i * 7),
          weightKg: kg,
          waistCm: 78 + i * 0.5,
        }),
      ),
    )
    renderFuel()
    const body = await card('Body and energy')
    expect(
      within(body).getByRole('progressbar', { name: /progress toward your target range/i }),
    ).toHaveAttribute('aria-valuenow', '20')
    expect(within(body).getByText('Rate').closest('.stat')).toHaveTextContent('+0.4 kg a week')
    expect(within(body).getByText('Time to your range').closest('.stat')).toHaveTextContent(
      'about 12 weeks',
    )
    expect(within(body).getByText('Waist').closest('.stat')).toHaveTextContent(
      '+1.5 cm since 78 cm',
    )
    expect(within(body).getByText(/rough maintenance estimate/i)).toBeInTheDocument()
    expect(within(body).getByText(/treat this as a guide/i)).toBeInTheDocument()
    expect(within(body).getByText(/weight gain is not all muscle/i)).toBeInTheDocument()
  })
})

describe('Fuel tab creatine and protein powder', () => {
  it('shows creatine from the very first day, with a percentage once there are 3 days', async () => {
    await repositories.supplementLogs.save({
      id: `${TODAY}-creatine`,
      date: TODAY,
      supplement: 'creatine',
      amount: 3,
      unit: 'g',
      status: 'taken',
    })
    renderFuel()
    const consistency = await card('Consistency')
    expect(within(consistency).getByText('Creatine').closest('.stat')).toHaveTextContent(
      '1 day logged',
    )
    expect(within(consistency).getByText(/a percentage shows after 3 days/i)).toBeInTheDocument()
  })

  it('counts the protein from a ticked scoop in the protein numbers', async () => {
    await repositories.foodEntries.save(
      food(TODAY, 120, 24, { id: 'supp-protein-powder-2026-10-31', meal: 'post-workout' }),
    )
    renderFuel()
    const protein = await card('Protein, last 7 days')
    expect(within(protein).getByText(/post-workout/i)).toBeInTheDocument()
  })
})
