import type { DateKey } from './dates.ts'
import type { FoodEntry, NutritionTargets } from './types.ts'

export type MacroTotals = {
  caloriesKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Daily totals are always summed from the entries, never stored separately. */
export function calculateDailyNutrition(entries: readonly FoodEntry[]): MacroTotals {
  const total = entries.reduce(
    (t, e) => ({
      caloriesKcal: t.caloriesKcal + e.caloriesKcal,
      proteinG: t.proteinG + e.proteinG,
      carbsG: t.carbsG + e.carbsG,
      fatG: t.fatG + e.fatG,
      fibreG: t.fibreG + (e.fibreG ?? 0),
    }),
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
  )
  return {
    caloriesKcal: Math.round(total.caloriesKcal),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
    fibreG: round1(total.fibreG),
  }
}

/** Energy implied by the macros: 4 kcal/g protein and carbs, 9 kcal/g fat. */
export function macroCalories(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9)
}

/** Fills carbs and fat from a calorie and protein target (fat share of calories defaults to 23%). */
export function deriveMacroTargets(
  caloriesKcal: number,
  proteinG: number,
  effectiveFrom: DateKey,
  fatShare = 0.23,
): NutritionTargets {
  const fatG = Math.round((caloriesKcal * fatShare) / 9)
  const carbsG = Math.max(0, Math.round((caloriesKcal - proteinG * 4 - fatG * 9) / 4))
  return { caloriesKcal, proteinG, carbsG, fatG, effectiveFrom }
}

export type FoodValidationErrors = Partial<
  Record<'name' | 'quantity' | 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG', string>
>

/** Returns field-level messages; an empty object means the entry is valid. */
export function validateFoodEntry(entry: Partial<FoodEntry>): FoodValidationErrors {
  const errors: FoodValidationErrors = {}
  if (!entry.name?.trim()) errors.name = 'Enter a food name.'
  if (!(typeof entry.quantity === 'number' && entry.quantity > 0))
    errors.quantity = 'Quantity must be greater than 0.'
  const nonNegative = ['caloriesKcal', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const
  for (const key of nonNegative) {
    const value = entry[key]
    if (value === undefined && key === 'fibreG') continue
    if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0))
      errors[key] = 'Enter 0 or more.'
  }
  return errors
}

export type RemainingTargets = MacroTotals & { overBy: boolean }

/** Targets minus consumed, floored at 0 so being over is never shown as a negative or a failure. */
export function getRemaining(consumed: MacroTotals, targets: NutritionTargets): RemainingTargets {
  const left = (target: number, eaten: number) => Math.max(0, round1(target - eaten))
  return {
    caloriesKcal: left(targets.caloriesKcal, consumed.caloriesKcal),
    proteinG: left(targets.proteinG, consumed.proteinG),
    carbsG: left(targets.carbsG, consumed.carbsG),
    fatG: left(targets.fatG, consumed.fatG),
    fibreG: 0,
    overBy: consumed.caloriesKcal > targets.caloriesKcal,
  }
}
