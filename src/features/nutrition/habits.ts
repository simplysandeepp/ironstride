import { newId, repositories } from '../../db/repositories.ts'
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

/** `null` clears the entry (back to "not logged"). */
export async function setSupplementStatus(
  date: DateKey,
  supplement: SupplementConfig,
  status: SupplementStatus | null,
) {
  const id = supplementLogId(date, supplement.key)
  if (status === null) return repositories.supplementLogs.remove(id)
  await repositories.supplementLogs.save({
    id,
    date,
    supplement: supplement.key,
    amount: supplement.amount,
    unit: supplement.unit,
    status,
  })
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
  const current = await repositories.settings.get()
  return repositories.settings.save({ ...current, ...patch })
}
