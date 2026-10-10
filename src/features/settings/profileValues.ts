import { addDays, getDayOfWeek, isDateKey, type DateKey } from '../../domain/dates.ts'
import type { UserProfile } from '../../domain/types.ts'

/** Form state: every field is a string so partially typed input is never lost. */
export type ProfileValues = {
  trainingStartDate: string
  currentWeightKg: string
  targetWeightMinKg: string
  targetWeightMaxKg: string
  heightCm: string
  weeklyRunBaselineKm: string
  recentLongRunKm: string
  caloriesKcal: string
  proteinG: string
}

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>

/** The Monday on or after `today`, the default programme start. */
export function nextMonday(today: DateKey): DateKey {
  return addDays(today, (8 - getDayOfWeek(today)) % 7)
}

export function defaultProfileValues(today: DateKey): ProfileValues {
  return {
    trainingStartDate: nextMonday(today),
    currentWeightKg: '66',
    targetWeightMinKg: '72',
    targetWeightMaxKg: '75',
    heightCm: '175',
    weeklyRunBaselineKm: '18',
    recentLongRunKm: '10',
    caloriesKcal: '2700',
    proteinG: '130',
  }
}

export function profileToValues(
  profile: UserProfile,
  targets: { caloriesKcal: number; proteinG: number },
): ProfileValues {
  return {
    trainingStartDate: profile.trainingStartDate,
    currentWeightKg: String(profile.currentWeightKg),
    targetWeightMinKg: String(profile.targetWeightMinKg),
    targetWeightMaxKg: String(profile.targetWeightMaxKg),
    heightCm: String(profile.heightCm),
    weeklyRunBaselineKm: String(profile.weeklyRunBaselineKm),
    recentLongRunKm: String(profile.recentLongRunKm),
    caloriesKcal: String(targets.caloriesKcal),
    proteinG: String(targets.proteinG),
  }
}

const RANGES: Record<
  Exclude<keyof ProfileValues, 'trainingStartDate'>,
  { min: number; max: number; label: string }
> = {
  currentWeightKg: { min: 30, max: 250, label: 'Weight' },
  targetWeightMinKg: { min: 30, max: 250, label: 'Target minimum' },
  targetWeightMaxKg: { min: 30, max: 250, label: 'Target maximum' },
  heightCm: { min: 120, max: 230, label: 'Height' },
  weeklyRunBaselineKm: { min: 0, max: 200, label: 'Weekly running' },
  recentLongRunKm: { min: 0, max: 100, label: 'Long run' },
  caloriesKcal: { min: 1000, max: 6000, label: 'Calories' },
  proteinG: { min: 20, max: 400, label: 'Protein' },
}

export function validateProfileValues(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!isDateKey(values.trainingStartDate)) errors.trainingStartDate = 'Pick a valid start date.'
  for (const [key, { min, max, label }] of Object.entries(RANGES)) {
    const field = key as keyof typeof RANGES
    const n = Number(values[field])
    if (values[field].trim() === '' || !Number.isFinite(n) || n < min || n > max) {
      errors[field] = `${label} should be between ${min} and ${max}.`
    }
  }
  if (!errors.targetWeightMinKg && !errors.targetWeightMaxKg) {
    if (Number(values.targetWeightMinKg) > Number(values.targetWeightMaxKg)) {
      errors.targetWeightMaxKg = 'Maximum should not be below the minimum.'
    }
  }
  return errors
}

export function toProfile(
  values: ProfileValues,
  existing: UserProfile | undefined,
  nowIso: string,
): UserProfile {
  return {
    id: 'local-user',
    heightCm: Number(values.heightCm),
    currentWeightKg: Number(values.currentWeightKg),
    targetWeightMinKg: Number(values.targetWeightMinKg),
    targetWeightMaxKg: Number(values.targetWeightMaxKg),
    ageRange: existing?.ageRange ?? '20-25',
    dietaryPattern: 'vegan',
    weeklyRunBaselineKm: Number(values.weeklyRunBaselineKm),
    recentLongRunKm: Number(values.recentLongRunKm),
    gymDaysPerWeek: existing?.gymDaysPerWeek ?? 3,
    runDaysPerWeek: existing?.runDaysPerWeek ?? 4,
    gymSessionMinutes: existing?.gymSessionMinutes ?? 60,
    trainingStartDate: values.trainingStartDate,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  }
}
