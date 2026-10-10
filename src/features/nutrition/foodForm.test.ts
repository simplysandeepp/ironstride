import { describe, expect, it } from 'vitest'
import type { FoodEntry } from '../../domain/types.ts'
import { SAMPLE_FOODS } from '../../data/sampleFoods.ts'
import { macroCalories } from '../../domain/nutrition.ts'
import {
  emptyFoodForm,
  foodToForm,
  getRecentFoods,
  toFoodEntry,
  validateFoodForm,
} from './foodForm.ts'

const filled = {
  ...emptyFoodForm('lunch'),
  name: 'Dal',
  unit: 'katori',
  caloriesKcal: '150',
  proteinG: '9',
  carbsG: '24',
  fatG: '2',
}

describe('food form', () => {
  it('accepts a complete form and builds an entry', () => {
    expect(validateFoodForm(filled)).toEqual({})
    const entry = toFoodEntry(
      { ...filled, notes: ' home made ', favourite: true },
      { id: 'f1', date: '2026-10-12', time: '13:05' },
    )
    expect(entry).toMatchObject({
      id: 'f1',
      name: 'Dal',
      meal: 'lunch',
      caloriesKcal: 150,
      notes: 'home made',
      favourite: true,
      time: '13:05',
    })
    expect(entry.fibreG).toBeUndefined()
  })

  it('rejects empty, negative and non-numeric values', () => {
    const errors = validateFoodForm({
      ...filled,
      name: '',
      caloriesKcal: '-5',
      proteinG: '',
      carbsG: 'x',
      quantity: '0',
    })
    expect(Object.keys(errors).sort()).toEqual([
      'caloriesKcal',
      'carbsG',
      'name',
      'proteinG',
      'quantity',
    ])
    expect(validateFoodForm({ ...filled, fibreG: '-1' }).fibreG).toBeDefined()
  })

  it('round-trips an entry', () => {
    const entry = toFoodEntry(
      { ...filled, fibreG: '4' },
      { id: 'f1', date: '2026-10-12', time: '13:05' },
    )
    expect(toFoodEntry(foodToForm(entry), { id: 'f1', date: '2026-10-12', time: '13:05' })).toEqual(
      entry,
    )
  })
})

describe('getRecentFoods', () => {
  const food = (id: string, name: string, date: string, favourite = false): FoodEntry => ({
    id,
    date,
    name,
    meal: 'snack',
    quantity: 1,
    unit: 'piece',
    caloriesKcal: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    favourite,
  })

  it('removes duplicates by name, newest wins, favourites first', () => {
    const out = getRecentFoods([
      food('a', 'Banana', '2026-10-10'),
      food('b', 'banana', '2026-10-12'),
      food('c', 'Dal', '2026-10-11', true),
      food('d', 'Roti', '2026-10-09'),
    ])
    expect(out.map((f) => f.id)).toEqual(['c', 'b', 'd'])
  })

  it('respects the limit and empty input', () => {
    expect(getRecentFoods([])).toEqual([])
    expect(
      getRecentFoods([food('a', 'A', '2026-10-10'), food('b', 'B', '2026-10-11')], 1),
    ).toHaveLength(1)
  })
})

describe('sample foods', () => {
  it('have unique ids, positive values and macros roughly matching calories', () => {
    expect(new Set(SAMPLE_FOODS.map((s) => s.id)).size).toBe(SAMPLE_FOODS.length)
    for (const s of SAMPLE_FOODS) {
      expect(s.caloriesKcal, s.id).toBeGreaterThan(0)
      expect(
        Math.abs(macroCalories(s.proteinG, s.carbsG, s.fatG) - s.caloriesKcal) / s.caloriesKcal,
        s.id,
      ).toBeLessThan(0.2)
    }
  })

  it('covers the foods named in the spec', () => {
    const names = SAMPLE_FOODS.map((s) => s.name.toLowerCase()).join('|')
    for (const f of [
      'oats',
      'soy milk',
      'banana',
      'peanut butter',
      'chana',
      'rice',
      'roti',
      'dal',
      'tofu',
      'soy chunks',
      'chickpeas',
      'beans',
      'nuts',
      'protein powder',
      'plant milk',
    ]) {
      expect(names, f).toContain(f)
    }
  })
})
