import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { getLocalDateKey } from '../../domain/dates.ts'
import { showSystemNotification } from './notify.ts'
import { getDueReminders, mergeReminders, SNOOZE_MINUTES } from './reminders.ts'
import { loadMemory, markHandled, snooze } from './reminderStore.ts'

const CHECK_EVERY_MS = 30_000

/**
 * In-app reminders. Checks while the app is open; if notifications are allowed it also
 * posts a system notification once per reminder per day.
 */
export function ReminderBanner({ now = () => new Date() }: { now?: () => Date }) {
  const data = useLiveQuery(async () => ({
    reminders: mergeReminders(await db.reminders.toArray()),
    settings: await repositories.settings.get(),
  }))
  const [memory, setMemory] = useState(loadMemory)
  const [tick, setTick] = useState(0)
  const notified = useRef(new Set<string>())

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), CHECK_EVERY_MS)
    return () => clearInterval(id)
  }, [])

  const due = data
    ? getDueReminders(data.reminders, now(), memory, {
        start: data.settings.quietHoursStart,
        end: data.settings.quietHoursEnd,
      })
    : []
  const today = getLocalDateKey(now())
  const first = due[0]

  useEffect(() => {
    if (!first || !data?.settings.notificationsEnabled) return
    const key = `${today}|${first.id}`
    if (notified.current.has(key)) return
    notified.current.add(key)
    void showSystemNotification('IronStride', first.title)
  }, [first, today, data?.settings.notificationsEnabled, tick])

  if (!first) return null

  return (
    <div className="update-prompt" role="status" aria-label="Reminder">
      <p>
        <strong>Reminder:</strong> {first.title}
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          onClick={() => setMemory(markHandled(memory, today, first.id))}
        >
          Done
        </button>
        <button
          type="button"
          onClick={() =>
            setMemory(snooze(memory, today, first.id, now().getTime() + SNOOZE_MINUTES * 60_000))
          }
        >
          Snooze {SNOOZE_MINUTES} min
        </button>
      </div>
    </div>
  )
}
