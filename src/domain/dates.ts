/**
 * Date helpers. All calendar logic works on local date keys ("YYYY-MM-DD") and
 * does its arithmetic in UTC, so daylight-saving changes can never shift a day.
 */

export type DateKey = string

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/** 0 = Sunday ... 6 = Saturday, matching Date#getDay. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function isDateKey(value: string): value is DateKey {
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
}

function toUtcDate(key: DateKey): Date {
  if (!isDateKey(key)) throw new RangeError(`Invalid date key: ${key}`)
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtcDate(date: Date): DateKey {
  const y = String(date.getUTCFullYear()).padStart(4, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The calendar date of an instant in the user's timezone (device timezone by
 * default). Late-night logs therefore stay on the day the user experienced.
 */
export function getLocalDateKey(date: Date = new Date(), timeZone?: string): DateKey {
  if (!timeZone) {
    const y = String(date.getFullYear()).padStart(4, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcDate(new Date(toUtcDate(key).getTime() + days * MS_PER_DAY))
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY)
}

/** Day of week for a date key: 0 = Sunday ... 6 = Saturday. */
export function getDayOfWeek(key: DateKey): number {
  return toUtcDate(key).getUTCDay()
}

/** The first day of the week containing `key`. Defaults to Monday. */
export function getWeekStart(key: DateKey, weekStartsOn: WeekStart = 1): DateKey {
  const offset = (getDayOfWeek(key) - weekStartsOn + 7) % 7
  return addDays(key, -offset)
}

/** Seven date keys, starting at the week start. */
export function getWeekDays(key: DateKey, weekStartsOn: WeekStart = 1): DateKey[] {
  const start = getWeekStart(key, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Inclusive list of date keys from `start` to `end`. */
export function getDateRange(start: DateKey, end: DateKey): DateKey[] {
  const length = daysBetween(start, end)
  if (length < 0) return []
  return Array.from({ length: length + 1 }, (_, i) => addDays(start, i))
}

/** The last `days` calendar days ending on (and including) `end`. */
export function getLastNDays(end: DateKey, days: number): DateKey[] {
  if (days <= 0) return []
  return getDateRange(addDays(end, -(days - 1)), end)
}

/** "Saturday, 10 October" for a date key, independent of the device timezone. */
export function formatDateLong(key: DateKey): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(toUtcDate(key))
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** "12 Oct" for a date key. */
export function formatDayMonth(key: DateKey): string {
  return `${Number(key.slice(8))} ${MONTH_NAMES[Number(key.slice(5, 7)) - 1]}`
}
