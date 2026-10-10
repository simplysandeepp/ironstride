import { newId, repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { FoodEntry } from '../../domain/types.ts'

export const timeNow = (now: Date = new Date()) =>
  `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

/** Copies a food (recent, favourite or earlier entry) onto a date as a new entry. */
export function addCopy(source: FoodEntry, date: DateKey, now: Date = new Date()) {
  const { id: _id, ...rest } = source
  return repositories.foodEntries.save({ ...rest, id: newId(), date, time: timeNow(now) })
}

export function toggleFavourite(entry: FoodEntry) {
  return repositories.foodEntries.save({ ...entry, favourite: !entry.favourite })
}
