import { describe, expect, it } from 'vitest'
import {
  calculateDailyNutrition,
  deriveMacroTargets,
  getRemaining,
  macroCalories,
  validateFoodEntry,
} from './nutrition.ts'
import type { FoodEntry } from './types.ts'

const food = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'f1',
  date: '2026-10-10',
  meal: 'breakfast',
  name: 'Oats',
  quantity: 80,
  unit: 'g',
  caloriesKcal: 300,
  proteinG: 10,
  carbsG: 54,
  fatG: 5,
  ...over,
})

describe('daily nutrition', () => {
  it('is zero with no entries', () => {
    expect(calculateDailyNutrition([])).toEqual({
      caloriesKcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fibreG: 0,
    })
  })

  it('equals the sum of entries and follows edits and deletes', () => {
    const entries = [food(), food({ id: 'f2', caloriesKcal: 200, proteinG: 20, fibreG: 3 })]
    expect(calculateDailyNutrition(entries)).toMatchObject({
      caloriesKcal: 500,
      proteinG: 30,
      fibreG: 3,
    })
    expect(calculateDailyNutrition([entries[0]]).caloriesKcal).toBe(300)
    expect(calculateDailyNutrition([{ ...entries[0], caloriesKcal: 350 }]).caloriesKcal).toBe(350)
  })
})

describe('targets', () => {
  it('derives macros consistent with the calorie target (2700 kcal, 130 g protein)', () => {
    const t = deriveMacroTargets(2700, 130, '2026-10-10')
    expect(t.fatG).toBe(69)
    expect(t.carbsG).toBeGreaterThan(380)
    expect(Math.abs(macroCalories(t.proteinG, t.carbsG, t.fatG) - 2700)).toBeLessThanOrEqual(10)
  })

  it('floors remaining at zero when over and flags it without negative numbers', () => {
    const consumed = calculateDailyNutrition([food({ caloriesKcal: 3000, proteinG: 150 })])
    const left = getRemaining(consumed, deriveMacroTargets(2700, 130, '2026-10-10'))
    expect(left.caloriesKcal).toBe(0)
    expect(left.proteinG).toBe(0)
    expect(left.overBy).toBe(true)
  })

  it('does not rewrite past entries when a target changes', () => {
    const entries = [food()]
    const before = calculateDailyNutrition(entries)
    deriveMacroTargets(3000, 150, '2026-11-01')
    expect(calculateDailyNutrition(entries)).toEqual(before)
  })
})

describe('validateFoodEntry', () => {
  it('accepts a good entry', () => {
    expect(validateFoodEntry(food())).toEqual({})
  })

  it('rejects negative or missing values with field messages', () => {
    const errors = validateFoodEntry(
      food({ name: ' ', quantity: 0, caloriesKcal: -1, proteinG: -5 }),
    )
    expect(Object.keys(errors).sort()).toEqual(['caloriesKcal', 'name', 'proteinG', 'quantity'])
    expect(validateFoodEntry(food({ fibreG: -1 })).fibreG).toBeDefined()
    expect(validateFoodEntry(food({ carbsG: Number.NaN })).carbsG).toBeDefined()
  })
})
