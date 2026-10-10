import { SAMPLE_FOODS } from '../../data/sampleFoods.ts'
import { db } from '../../db/database.ts'
import { newId, repositories } from '../../db/repositories.ts'
import { timeNow } from './foodActions.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { AppSettings, SupplementConfig, SupplementLog } from '../../domain/types.ts'

export const DEFAULT_WATER_TARGET_ML = 3000
export const DEFAULT_WATER_SERVING_ML = 250

/** Creatine and protein powder start on (the user's current stack); B12 is opt-in. */
export const DEFAULT_SUPPLEMENTS: readonly SupplementConfig[] = [
  { key: 'creatine', label: 'Creatine monohydrate', amount: 3, unit: 'g', enabled: true },
  { key: 'protein-powder', label: 'Vegan protein powder', amount: 1, unit: 'scoop', enabled: true },
  { key: 'b12', label: 'Vitamin B12', amount: 1, unit: 'dose', enabled: false },
]

export const getWaterTarget = (s: AppSettings) => s.waterTargetMl ?? DEFAULT_WATER_TARGET_ML
export const getWaterServing = (s: AppSettings) => s.waterServingMl ?? DEFAULT_WATER_SERVING_ML

/** Saved config wins; supplements added in later versions fall back to their defaults. */
export function getSupplements(settings: AppSettings): SupplementConfig[] {
  const saved = new Map((settings.supplements ?? []).map((c) => [c.key, c]))
  return DEFAULT_SUPPLEMENTS.map((d) => saved.get(d.key) ?? d)
}

export type SupplementStatus = SupplementLog['status']

/** One deterministic record per supplement per day, so repeated taps cannot duplicate it. */
export const supplementLogId = (date: DateKey, key: string) => `${date}-${key}`

export const PROTEIN_POWDER_KEY = 'protein-powder'

/** One food entry per day for the protein powder, so repeated ticks can never double-count it. */
export const proteinPowderFoodId = (date: DateKey) => `supp-${PROTEIN_POWDER_KEY}-${date}`

const PROTEIN_NOTE =
  'Added when you ticked your protein powder. Edit it here if your scoop differs.'

/**
 * Keeps the food log in step with the protein powder tick, because the protein numbers and charts
 * read the food log. Ticking adds the scoop (post-workout) using your most recent protein powder
 * entry, so the brand's real numbers carry over once you have edited them; unticking, skipping or
 * marking it not applicable removes it. An existing entry is left alone, so edits are kept.
 */
async function syncProteinPowderFood(
  date: DateKey,
  supplement: SupplementConfig,
  status: SupplementStatus | null,
  time: string | undefined = timeNow(),
) {
  const id = proteinPowderFoodId(date)
  if (status !== 'taken') {
    await repositories.foodEntries.remove(id)
    return
  }
  if (await repositories.foodEntries.get(id)) return
  const earlier = (await db.foodEntries.toArray())
    .filter((e) => /protein powder/i.test(e.name) && e.id !== id)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''))[0]
  const sample = SAMPLE_FOODS.find((f) => f.id === PROTEIN_POWDER_KEY)!
  const base = earlier ?? { ...sample, quantity: supplement.amount, unit: supplement.unit }
  await repositories.foodEntries.save({
    id,
    date,
    time,
    meal: 'post-workout',
    name: base.name,
    quantity: base.quantity,
    unit: base.unit,
    caloriesKcal: base.caloriesKcal,
    proteinG: base.proteinG,
    carbsG: base.carbsG,
    fatG: base.fatG,
    notes: PROTEIN_NOTE,
  })
}

/** `null` clears the entry (back to "not logged"). */
export async function setSupplementStatus(
  date: DateKey,
  supplement: SupplementConfig,
  status: SupplementStatus | null,
) {
  const id = supplementLogId(date, supplement.key)
  if (status === null) await repositories.supplementLogs.remove(id)
  else {
    await repositories.supplementLogs.save({
      id,
      date,
      supplement: supplement.key,
      amount: supplement.amount,
      unit: supplement.unit,
      status,
    })
  }
  if (supplement.key === PROTEIN_POWDER_KEY) await syncProteinPowderFood(date, supplement, status)
}

/**
 * Earlier ticks were recorded before the food log was linked. Once, add them so past protein shows
 * up in the charts. It runs a single time, so an entry you later delete on purpose stays deleted.
 */
export async function backfillProteinPowderFood() {
  const settings = await repositories.settings.get()
  if (settings.proteinPowderLinked) return
  const supplement = getSupplements(settings).find((s) => s.key === PROTEIN_POWDER_KEY)
  if (supplement) {
    const taken = (await db.supplementLogs.toArray())
      .filter((l) => l.supplement === PROTEIN_POWDER_KEY && l.status === 'taken')
      .sort((a, b) => a.date.localeCompare(b.date))
    for (const log of taken) await syncProteinPowderFood(log.date, supplement, 'taken', undefined)
  }
  await updateSettings({ proteinPowderLinked: true })
}

export const addWater = (date: DateKey, amountMl: number, now: Date = new Date()) =>
  repositories.waterEntries.save({ id: newId(), date, amountMl, createdAt: now.toISOString() })

/** Removes the most recently added water entry for the date, if any. */
export async function undoLastWater(date: DateKey) {
  const entries = await repositories.waterEntries.onDate(date)
  // Database order follows the random id, so pick the newest by its timestamp.
  const last = [...entries]
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .at(-1)
  if (last) await repositories.waterEntries.remove(last.id)
}

export async function updateSettings(patch: Partial<AppSettings>) {
  // One transaction, so a background write (such as the backup timestamp) cannot clobber another edit.
  return db.transaction('rw', db.settings, async () => {
    const current = await repositories.settings.get()
    return repositories.settings.save({ ...current, ...patch })
  })
}
