import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import { deriveMacroTargets } from '../../domain/nutrition.ts'
import {
  acceptCalorieSuggestion,
  bodyMeasurementId,
  dismissSuggestion,
  emptyBodyForm,
  isWaistRising,
  toMeasurement,
  validateBodyForm,
} from './bodyWeight.ts'

describe('body form', () => {
  it('needs a weight or a waist and keeps values in range', () => {
    expect(validateBodyForm(emptyBodyForm()).weightKg).toMatch(/weight or your waist/i)
    expect(validateBodyForm({ weightKg: '66.4', waistCm: '', notes: '' })).toEqual({})
    expect(validateBodyForm({ weightKg: '', waistCm: '78', notes: '' })).toEqual({})
    expect(validateBodyForm({ weightKg: '5', waistCm: '300', notes: '' })).toMatchObject({
      weightKg: expect.any(String),
      waistCm: expect.any(String),
    })
    expect(validateBodyForm({ weightKg: 'abc', waistCm: '', notes: '' }).weightKg).toBeDefined()
  })

  it('stores one measurement per day, omitting blank fields', () => {
    const m = toMeasurement('2026-10-12', { weightKg: '66.4', waistCm: '', notes: ' fasted ' })
    expect(m).toEqual({
      id: bodyMeasurementId('2026-10-12'),
      date: '2026-10-12',
      weightKg: 66.4,
      notes: 'fasted',
    })
  })
})

describe('isWaistRising', () => {
  const w = (date: string, waistCm: number) => ({ id: date, date, waistCm })
  it('flags a 2 cm rise and ignores noise or missing data', () => {
    expect(isWaistRising([w('2026-10-01', 78), w('2026-10-22', 80.5)])).toBe(true)
    expect(isWaistRising([w('2026-10-01', 78), w('2026-10-22', 78.5)])).toBe(false)
    expect(isWaistRising([w('2026-10-01', 78)])).toBe(false)
    expect(isWaistRising([])).toBe(false)
  })
})

describe('suggestions need consent', () => {
  beforeEach(async () => {
    await repositories.settings.save(DEFAULT_SETTINGS)
    await repositories.nutritionTargets.save(deriveMacroTargets(2700, 130, '2026-01-01'))
  })

  it('applies a calorie change only when accepted, effective from that day, keeping history', async () => {
    await acceptCalorieSuggestion({ deltaKcal: 150, reason: 'x' }, '2026-10-12')
    expect((await repositories.nutritionTargets.forDate('2026-10-12'))?.caloriesKcal).toBe(2850)
    expect((await repositories.nutritionTargets.forDate('2026-10-11'))?.caloriesKcal).toBe(2700)
    expect((await repositories.nutritionTargets.forDate('2026-10-12'))?.proteinG).toBe(130)
  })

  it('remembers a dismissed suggestion', async () => {
    await dismissSuggestion('2026-10-12')
    expect((await repositories.settings.get()).dismissedCalorieSuggestion).toBe('2026-10-12')
  })
})
