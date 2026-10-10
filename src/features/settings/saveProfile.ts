import { getLocalDateKey } from '../../domain/dates.ts'
import { deriveMacroTargets } from '../../domain/nutrition.ts'
import { repositories } from '../../db/repositories.ts'
import { toProfile, type ProfileValues } from './profileValues.ts'

/** Saves profile, nutrition targets (effective today) and marks onboarding done. */
export async function saveProfileValues(values: ProfileValues, now: Date = new Date()) {
  const existing = await repositories.profile.get()
  await repositories.profile.save(toProfile(values, existing, now.toISOString()))

  const calories = Number(values.caloriesKcal)
  const protein = Number(values.proteinG)
  const current = await repositories.nutritionTargets.forDate(getLocalDateKey(now))
  if (current?.caloriesKcal !== calories || current?.proteinG !== protein) {
    // A new row keyed by today, so earlier days keep the targets they had.
    await repositories.nutritionTargets.save(
      deriveMacroTargets(calories, protein, getLocalDateKey(now)),
    )
  }

  const settings = await repositories.settings.get()
  await repositories.settings.save({ ...settings, onboardingCompleted: true })
}

/** Onboarding "Skip": sensible defaults are saved and can be edited later in Settings. */
export async function skipOnboarding() {
  const settings = await repositories.settings.get()
  await repositories.settings.save({ ...settings, onboardingCompleted: true })
}
