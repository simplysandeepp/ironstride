import { type DateKey } from '../../domain/dates.ts'
import { getPlannedWorkoutsForDate } from '../../domain/planner.ts'
import type { Programme } from '../../domain/programme.ts'

/** Dates in the programme whose only plan is a rest day. They are not misses and not blanks. */
export function getPlannedRestDays(
  programme: Programme,
  startDate: DateKey,
  dates: readonly DateKey[],
): Set<DateKey> {
  const rest = new Set<DateKey>()
  for (const date of dates) {
    const planned = getPlannedWorkoutsForDate(programme, date, startDate)
    if (planned.length > 0 && planned.every((w) => w.type === 'rest')) rest.add(date)
  }
  return rest
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Month abbreviation for the first column of each new month, otherwise empty. */
export function monthLabels(columns: readonly (readonly ({ date: DateKey } | null)[])[]): string[] {
  let last = ''
  return columns.map((col) => {
    const first = col.find((c) => c !== null)
    if (!first) return ''
    const month = first.date.slice(0, 7)
    if (month === last) return ''
    last = month
    return MONTHS[Number(first.date.slice(5, 7)) - 1]
  })
}
