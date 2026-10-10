import { repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import { deriveMacroTargets } from '../../domain/nutrition.ts'
import type { BodyMeasurement } from '../../domain/types.ts'
import type { CalorieSuggestion, WeeklyAverage } from '../../domain/weightTrend.ts'
import { updateSettings } from './habits.ts'

export type BodyForm = { weightKg: string; waistCm: string; notes: string }
export type BodyErrors = Partial<Record<keyof BodyForm, string>>

export const emptyBodyForm = (m?: BodyMeasurement): BodyForm => ({
  weightKg: m?.weightKg === undefined ? '' : String(m.weightKg),
  waistCm: m?.waistCm === undefined ? '' : String(m.waistCm),
  notes: m?.notes ?? '',
})

export function validateBodyForm(form: BodyForm): BodyErrors {
  const errors: BodyErrors = {}
  const check = (key: 'weightKg' | 'waistCm', min: number, max: number, label: string) => {
    if (form[key].trim() === '') return
    const n = Number(form[key])
    if (!Number.isFinite(n) || n < min || n > max)
      errors[key] = `${label} should be between ${min} and ${max}.`
  }
  check('weightKg', 30, 250, 'Weight')
  check('waistCm', 40, 200, 'Waist')
  if (form.weightKg.trim() === '' && form.waistCm.trim() === '') {
    errors.weightKg = 'Enter your weight or your waist measurement.'
  }
  return errors
}

/** One measurement per day, keyed by date, so a correction replaces the earlier value. */
export const bodyMeasurementId = (date: DateKey) => `${date}-body`

export function toMeasurement(date: DateKey, form: BodyForm): BodyMeasurement {
  return {
    id: bodyMeasurementId(date),
    date,
    ...(form.weightKg.trim() !== '' && { weightKg: Number(form.weightKg) }),
    ...(form.waistCm.trim() !== '' && { waistCm: Number(form.waistCm) }),
    ...(form.notes.trim() !== '' && { notes: form.notes.trim() }),
  }
}

export const saveMeasurement = (m: BodyMeasurement) => repositories.bodyMeasurements.save(m)

/** True when the waist grew by 2 cm or more between the first and last entries of the last 3 weeks. */
export function isWaistRising(measurements: readonly BodyMeasurement[]): boolean {
  const waists = measurements
    .filter((m) => m.waistCm !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-4)
  return waists.length >= 2 && waists[waists.length - 1].waistCm! - waists[0].waistCm! >= 2
}

/** Applies a suggestion only because the user accepted it; history keeps its old targets. */
export async function acceptCalorieSuggestion(suggestion: CalorieSuggestion, today: DateKey) {
  const current = await repositories.nutritionTargets.forDate(today)
  if (!current) return
  await repositories.nutritionTargets.save(
    deriveMacroTargets(current.caloriesKcal + suggestion.deltaKcal, current.proteinG, today),
  )
}

export const suggestionKey = (weekly: readonly WeeklyAverage[]) =>
  weekly[weekly.length - 1]?.weekStart

export const dismissSuggestion = (key: string) =>
  updateSettings({ dismissedCalorieSuggestion: key })
