import { getDayOfWeek, getLocalDateKey, type DateKey } from '../../domain/dates.ts'
import { getZonedTimeOfDay } from '../../domain/timezone.ts'
import type { Reminder } from '../../domain/types.ts'

type Defaults = Omit<Reminder, 'enabled'>

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Starting reminders. All are off until the user turns them on. 0 = Sunday ... 6 = Saturday. */
export const DEFAULT_REMINDERS: readonly Defaults[] = [
  { id: 'gym', title: 'Gym session today', type: 'gym', timeLocal: '07:30', weekdays: [1, 3, 5] },
  { id: 'run', title: 'Run today', type: 'run', timeLocal: '06:30', weekdays: [1, 2, 4, 6] },
  {
    id: 'creatine',
    title: 'Creatine (3 g)',
    type: 'supplement',
    timeLocal: '09:00',
    weekdays: ALL_DAYS,
  },
  { id: 'meals', title: 'Log your meals', type: 'meal', timeLocal: '14:00', weekdays: ALL_DAYS },
  { id: 'water', title: 'Drink some water', type: 'water', timeLocal: '16:00', weekdays: ALL_DAYS },
  {
    id: 'review',
    title: 'Evening review and weight',
    type: 'review',
    timeLocal: '21:00',
    weekdays: ALL_DAYS,
  },
  {
    id: 'rest',
    title: 'Recovery day: rest, walk or mobility',
    type: 'review',
    timeLocal: '09:00',
    weekdays: [0],
  },
]

/** Where tapping a reminder's notification should land. */
export function reminderPath(type: Reminder['type']): string {
  switch (type) {
    case 'gym':
      return '/gym'
    case 'run':
      return '/run'
    // Meals, water, creatine and the evening weight all live on the nutrition screen.
    default:
      return '/nutrition'
  }
}

/** Saved changes win; reminders added in later versions still show up with their defaults. */
export function mergeReminders(saved: readonly Reminder[]): Reminder[] {
  const byId = new Map(saved.map((r) => [r.id, r]))
  return DEFAULT_REMINDERS.map((d) => byId.get(d.id) ?? { ...d, enabled: false })
}

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

export const timeOf = (now: Date) => getZonedTimeOfDay(now)

/** Quiet hours may wrap midnight (22:00 to 07:00). Unset or equal times mean no quiet hours. */
export function isInQuietHours(time: string, start?: string, end?: string): boolean {
  if (!start || !end || !isValidTime(start) || !isValidTime(end) || start === end) return false
  const t = minutes(time)
  const s = minutes(start)
  const e = minutes(end)
  return s < e ? t >= s && t < e : t >= s || t < e
}

/** A reminder that was missed by more than this is dropped instead of firing hours late. */
export const LATE_WINDOW_MINUTES = 120
export const SNOOZE_MINUTES = 10

export type ReminderMemory = {
  /** "date|id" keys of reminders already shown or dismissed today. */
  fired: ReadonlySet<string>
  /** Reminder id to the time (ms since epoch) it may show again. */
  snoozedUntil: Readonly<Record<string, number>>
}

export const firedKey = (date: DateKey, id: string) => `${date}|${id}`

/**
 * Reminders to show right now. Pure, so it can be tested with any clock.
 * Only evaluates while the app is open; it cannot wake a closed app.
 */
export function getDueReminders(
  reminders: readonly Reminder[],
  now: Date,
  memory: ReminderMemory,
  quiet: { start?: string; end?: string } = {},
): Reminder[] {
  const date = getLocalDateKey(now)
  const nowTime = timeOf(now)
  if (isInQuietHours(nowTime, quiet.start, quiet.end)) return []
  const dow = getDayOfWeek(date)
  return reminders.filter((r) => {
    if (!r.enabled || !r.weekdays.includes(dow) || !isValidTime(r.timeLocal)) return false
    if (memory.fired.has(firedKey(date, r.id))) return false
    if ((memory.snoozedUntil[r.id] ?? 0) > now.getTime()) return false
    const late = minutes(nowTime) - minutes(r.timeLocal)
    return late >= 0 && late <= LATE_WINDOW_MINUTES
  })
}

export type NotificationSupport = {
  supported: boolean
  permission: 'granted' | 'denied' | 'default' | 'unsupported'
}

export function getNotificationSupport(): NotificationSupport {
  if (typeof Notification === 'undefined') return { supported: false, permission: 'unsupported' }
  return { supported: true, permission: Notification.permission }
}

/** Plain-language status, including what cannot be promised. */
export function describeSupport(s: NotificationSupport): string {
  if (!s.supported)
    return 'This browser does not support notifications. Reminders will appear inside the app while it is open.'
  if (s.permission === 'granted') return 'Notifications are allowed.'
  if (s.permission === 'denied')
    return 'Notifications are blocked for this site. You can allow them in the browser or phone settings. Reminders still appear inside the app.'
  return 'Notifications are not enabled yet.'
}

export const LIMITS_NOTE =
  'Reminders are checked only while IronStride is open or recently used. Android may not run a web app in the background, so a reminder can be late or missed if the app is closed. For a guaranteed alert, also set an alarm in your Clock app.'
