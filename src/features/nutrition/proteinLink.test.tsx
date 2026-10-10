import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import { calculateDailyNutrition } from '../../domain/nutrition.ts'
import { defaultProfileValues, toProfile } from '../settings/profileValues.ts'
import { TodayScreen } from '../today/TodayScreen.tsx'
import {
  backfillProteinPowderFood,
  DEFAULT_SUPPLEMENTS,
  proteinPowderFoodId,
  setSupplementStatus,
} from './habits.ts'

const D = '2026-10-12'
const protein = DEFAULT_SUPPLEMENTS.find((s) => s.key === 'protein-powder')!
const creatine = DEFAULT_SUPPLEMENTS.find((s) => s.key === 'creatine')!

beforeEach(async () => {
  await repositories.settings.save(DEFAULT_SETTINGS)
})

describe('protein powder and the food log', () => {
  it('adds its protein to the food log when ticked, as a post-workout item', async () => {
    await setSupplementStatus(D, protein, 'taken')
    const entry = await repositories.foodEntries.get(proteinPowderFoodId(D))
    expect(entry).toMatchObject({
      date: D,
      meal: 'post-workout',
      proteinG: 24,
      caloriesKcal: 120,
      unit: 'scoop',
    })
    expect(calculateDailyNutrition(await repositories.foodEntries.onDate(D)).proteinG).toBe(24)
  })

  it('counts it once however many times it is ticked', async () => {
    await setSupplementStatus(D, protein, 'taken')
    await setSupplementStatus(D, protein, 'taken')
    await setSupplementStatus(D, protein, 'taken')
    expect(await repositories.foodEntries.onDate(D)).toHaveLength(1)
  })

  it('removes it again when unticked, skipped or marked not applicable', async () => {
    for (const status of [null, 'skipped', 'not-applicable'] as const) {
      await setSupplementStatus(D, protein, 'taken')
      expect(await repositories.foodEntries.onDate(D)).toHaveLength(1)
      await setSupplementStatus(D, protein, status)
      expect(await repositories.foodEntries.onDate(D), String(status)).toHaveLength(0)
    }
  })

  it('keeps edits you made to the entry when ticked again', async () => {
    await setSupplementStatus(D, protein, 'taken')
    const id = proteinPowderFoodId(D)
    await repositories.foodEntries.save({
      ...(await repositories.foodEntries.get(id))!,
      proteinG: 27,
    })
    await setSupplementStatus(D, protein, 'taken')
    expect((await repositories.foodEntries.get(id))?.proteinG).toBe(27)
  })

  it('uses the real numbers of your most recent protein powder entry for later days', async () => {
    await repositories.foodEntries.save({
      id: 'mine',
      date: '2026-10-10',
      meal: 'snack',
      name: 'Brand X protein powder',
      quantity: 1,
      unit: 'scoop',
      caloriesKcal: 110,
      proteinG: 25.5,
      carbsG: 2,
      fatG: 1.5,
    })
    await setSupplementStatus(D, protein, 'taken')
    expect(await repositories.foodEntries.get(proteinPowderFoodId(D))).toMatchObject({
      name: 'Brand X protein powder',
      proteinG: 25.5,
      caloriesKcal: 110,
    })
  })

  it('never adds food for creatine, which has no calories', async () => {
    await setSupplementStatus(D, creatine, 'taken')
    expect(await repositories.foodEntries.onDate(D)).toHaveLength(0)
  })
})

describe('backfillProteinPowderFood', () => {
  it('adds earlier ticks to the food log once, and not again after you delete one', async () => {
    for (const d of ['2026-10-10', '2026-10-11']) {
      await repositories.supplementLogs.save({
        id: `${d}-protein-powder`,
        date: d,
        supplement: 'protein-powder',
        amount: 1,
        unit: 'scoop',
        status: 'taken',
      })
    }
    await repositories.supplementLogs.save({
      id: '2026-10-09-protein-powder',
      date: '2026-10-09',
      supplement: 'protein-powder',
      amount: 1,
      unit: 'scoop',
      status: 'skipped',
    })
    await backfillProteinPowderFood()
    expect((await repositories.foodEntries.all()).map((f) => f.date).sort()).toEqual([
      '2026-10-10',
      '2026-10-11',
    ])
    expect((await repositories.settings.get()).proteinPowderLinked).toBe(true)

    await repositories.foodEntries.remove(proteinPowderFoodId('2026-10-10'))
    await backfillProteinPowderFood()
    expect(await repositories.foodEntries.all()).toHaveLength(1)
  })

  it('does nothing harmful with no ticks', async () => {
    await backfillProteinPowderFood()
    expect(await repositories.foodEntries.all()).toHaveLength(0)
    expect((await repositories.settings.get()).proteinPowderLinked).toBe(true)
  })
})

describe('Today screen', () => {
  it('shows the protein from the scoop straight away', async () => {
    await repositories.profile.save(
      toProfile(
        { ...defaultProfileValues(D), trainingStartDate: D },
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
    render(
      <MemoryRouter>
        <TodayScreen today={D} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/adds its protein to today's food log/i)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('checkbox', { name: /protein powder/i }))
    await waitFor(() => expect(screen.getByText('24')).toBeInTheDocument())
    expect(screen.getByText(/\/ 130 g protein/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /protein powder/i }))
    await waitFor(() => expect(screen.queryByText('24')).toBeNull())
  })
})
