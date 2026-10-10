import type { DateKey } from '../../domain/dates.ts'
import { newId, repositories } from '../../db/repositories.ts'

export const WATER_SERVING_ML = 250
export const WATER_TARGET_ML = 3000

export type QuickSupplement = { key: string; label: string; amount: number; unit: string }

export const QUICK_SUPPLEMENTS: readonly QuickSupplement[] = [
  { key: 'creatine', label: 'Creatine 3 g', amount: 3, unit: 'g' },
  { key: 'protein-powder', label: 'Protein powder, 1 scoop', amount: 1, unit: 'scoop' },
]

/** One deterministic record per supplement per day, so repeated taps cannot duplicate it. */
export const supplementLogId = (date: DateKey, key: string) => `${date}-${key}`

export async function setSupplementTaken(
  date: DateKey,
  supplement: QuickSupplement,
  taken: boolean,
) {
  const id = supplementLogId(date, supplement.key)
  if (!taken) return repositories.supplementLogs.remove(id)
  await repositories.supplementLogs.save({
    id,
    date,
    supplement: supplement.key,
    amount: supplement.amount,
    unit: supplement.unit,
    status: 'taken',
  })
}

export const addWater = (date: DateKey, amountMl = WATER_SERVING_ML) =>
  repositories.waterEntries.save({ id: newId(), date, amountMl })
