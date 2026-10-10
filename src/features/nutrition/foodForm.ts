import { validateFoodEntry, type FoodValidationErrors } from '../../domain/nutrition.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { FoodEntry, MealType } from '../../domain/types.ts'
import type { SampleFood } from '../../data/sampleFoods.ts'

export const MEALS: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'pre-workout', label: 'Pre-workout' },
  { value: 'post-workout', label: 'Post-workout' },
]

export const mealLabel = (meal: MealType) => MEALS.find((m) => m.value === meal)?.label ?? meal

export type FoodFormValues = {
  name: string
  meal: MealType
  quantity: string
  unit: string
  caloriesKcal: string
  proteinG: string
  carbsG: string
  fatG: string
  fibreG: string
  notes: string
  favourite: boolean
}

export const emptyFoodForm = (meal: MealType = 'breakfast'): FoodFormValues => ({
  name: '',
  meal,
  quantity: '1',
  unit: 'serving',
  caloriesKcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fibreG: '',
  notes: '',
  favourite: false,
})

type Source = Pick<
  FoodEntry,
  'name' | 'meal' | 'quantity' | 'unit' | 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG'
> &
  Partial<Pick<FoodEntry, 'fibreG' | 'notes' | 'favourite'>>

export function foodToForm(food: Source | SampleFood): FoodFormValues {
  const f = food as Source
  return {
    name: f.name,
    meal: f.meal,
    quantity: String(f.quantity),
    unit: f.unit,
    caloriesKcal: String(f.caloriesKcal),
    proteinG: String(f.proteinG),
    carbsG: String(f.carbsG),
    fatG: String(f.fatG),
    fibreG: f.fibreG === undefined ? '' : String(f.fibreG),
    notes: f.notes ?? '',
    favourite: f.favourite ?? false,
  }
}

const num = (text: string) => (text.trim() === '' ? Number.NaN : Number(text))

function toPartial(values: FoodFormValues): Partial<FoodEntry> {
  return {
    name: values.name,
    quantity: num(values.quantity),
    caloriesKcal: num(values.caloriesKcal),
    proteinG: num(values.proteinG),
    carbsG: num(values.carbsG),
    fatG: num(values.fatG),
    ...(values.fibreG.trim() !== '' && { fibreG: Number(values.fibreG) }),
  }
}

export const validateFoodForm = (values: FoodFormValues): FoodValidationErrors =>
  validateFoodEntry(toPartial(values))

export function toFoodEntry(
  values: FoodFormValues,
  options: { id: string; date: DateKey; time: string },
): FoodEntry {
  return {
    id: options.id,
    date: options.date,
    time: options.time,
    meal: values.meal,
    name: values.name.trim(),
    quantity: Number(values.quantity),
    unit: values.unit.trim() || 'serving',
    caloriesKcal: Number(values.caloriesKcal),
    proteinG: Number(values.proteinG),
    carbsG: Number(values.carbsG),
    fatG: Number(values.fatG),
    ...(values.fibreG.trim() !== '' && { fibreG: Number(values.fibreG) }),
    ...(values.notes.trim() !== '' && { notes: values.notes.trim() }),
    ...(values.favourite && { favourite: true }),
  }
}

/** Distinct foods by name and unit, newest first; favourites are listed first. */
export function getRecentFoods(entries: readonly FoodEntry[], limit = 8): FoodEntry[] {
  const seen = new Set<string>()
  const ordered = [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''),
  )
  const unique = ordered.filter((e) => {
    const key = `${e.name.toLowerCase()}|${e.unit.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...unique.filter((e) => e.favourite), ...unique.filter((e) => !e.favourite)].slice(
    0,
    limit,
  )
}
