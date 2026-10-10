/**
 * The app runs on India Standard Time. Every "today", every logged time of day and every shown
 * timestamp uses this zone, whatever time zone the phone or browser happens to be set to, so a
 * late-night log lands on the right day and reminders fire at the time you chose.
 * IST has no daylight saving, which keeps the arithmetic simple.
 */
export const APP_TIME_ZONE = 'Asia/Kolkata'
export const APP_TIME_ZONE_LABEL = 'IST'

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', options)
    formatters.set(key, f)
  }
  return f
}

/** "13:05" in the given zone (24-hour). */
export function getZonedTimeOfDay(
  date: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): string {
  return formatter(`time|${timeZone}`, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

/** "10 Oct, 13:05 IST" for an ISO timestamp. An unreadable value is returned unchanged. */
export function formatDateTime(iso: string, timeZone: string = APP_TIME_ZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = formatter(`day|${timeZone}`, { timeZone, day: 'numeric', month: 'short' }).format(
    date,
  )
  const label = timeZone === APP_TIME_ZONE ? APP_TIME_ZONE_LABEL : timeZone
  return `${day}, ${getZonedTimeOfDay(date, timeZone)} ${label}`
}
