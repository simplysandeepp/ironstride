import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import type { Reminder } from '../../domain/types.ts'
import { updateSettings } from '../nutrition/habits.ts'
import { firedKey, mergeReminders, type ReminderMemory } from './reminders.ts'

/**
 * Edits one reminder by reading its latest saved state inside the same transaction, so two quick
 * edits (say a new time and then a day toggle) can never overwrite each other with stale values.
 */
export async function updateReminder(id: string, change: (current: Reminder) => Partial<Reminder>) {
  await db.transaction('rw', db.reminders, async () => {
    const current = (await db.reminders.get(id)) ?? mergeReminders([]).find((r) => r.id === id)
    if (current) await db.reminders.put({ ...current, ...change(current) })
  })
}

export async function setQuietHours(start: string | undefined, end: string | undefined) {
  await updateSettings({ quietHoursStart: start, quietHoursEnd: end })
}

export async function setNotificationsEnabled(enabled: boolean) {
  await updateSettings({ notificationsEnabled: enabled })
}

export const readSettings = () => repositories.settings.get()

/**
 * Which reminders were already handled today, and which are snoozed. Kept in
 * localStorage because it is tiny, per-device and safe to lose.
 */
const MEMORY_KEY = 'ironstride.reminderMemory'

type Stored = { fired: string[]; snoozedUntil: Record<string, number> }

export function loadMemory(): ReminderMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? 'null') as Stored | null
    return { fired: new Set(raw?.fired ?? []), snoozedUntil: raw?.snoozedUntil ?? {} }
  } catch {
    return { fired: new Set(), snoozedUntil: {} }
  }
}

function saveMemory(memory: ReminderMemory, today: string) {
  try {
    // Drop old days so this never grows.
    const fired = [...memory.fired].filter((k) => k.startsWith(today))
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify({ fired, snoozedUntil: memory.snoozedUntil } satisfies Stored),
    )
  } catch {
    // Storage unavailable: reminders may repeat after a reload, nothing breaks.
  }
}

export function markHandled(memory: ReminderMemory, today: string, id: string): ReminderMemory {
  const next = {
    fired: new Set(memory.fired).add(firedKey(today, id)),
    snoozedUntil: memory.snoozedUntil,
  }
  saveMemory(next, today)
  return next
}

export function snooze(
  memory: ReminderMemory,
  today: string,
  id: string,
  untilMs: number,
): ReminderMemory {
  const next = { fired: memory.fired, snoozedUntil: { ...memory.snoozedUntil, [id]: untilMs } }
  saveMemory(next, today)
  return next
}
