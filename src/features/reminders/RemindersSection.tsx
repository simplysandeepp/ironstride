import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { requestNotificationPermission, showSystemNotification } from './notify.ts'
import {
  describeSupport,
  getNotificationSupport,
  isValidTime,
  LIMITS_NOTE,
  mergeReminders,
  type NotificationSupport,
} from './reminders.ts'
import { setNotificationsEnabled, setQuietHours, updateReminder } from './reminderStore.ts'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RemindersSection() {
  const [support, setSupport] = useState<NotificationSupport>(getNotificationSupport)
  const [testResult, setTestResult] = useState<string>()
  const data = useLiveQuery(async () => ({
    reminders: mergeReminders(await db.reminders.toArray()),
    settings: await repositories.settings.get(),
  }))
  if (!data) return null

  const { reminders, settings } = data

  async function enableNotifications() {
    const result = await requestNotificationPermission()
    setSupport(getNotificationSupport())
    await setNotificationsEnabled(result === 'granted')
  }

  async function sendTest() {
    const ok = await showSystemNotification(
      'IronStride test',
      'Notifications are working on this device.',
    )
    setTestResult(
      ok
        ? 'Test notification sent.'
        : 'Could not send a notification. Check that notifications are allowed.',
    )
  }

  return (
    <section className="card" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading">Reminders</h2>
      <p className="helper">{LIMITS_NOTE}</p>
      <p role="status">{describeSupport(support)}</p>

      {support.supported && support.permission !== 'granted' && support.permission !== 'denied' && (
        <>
          <p className="helper">
            If you allow notifications, IronStride can also show a system notification when a
            reminder is due and the app is open. We only ask when you tap this button.
          </p>
          <button type="button" className="primary" onClick={() => void enableNotifications()}>
            Enable notifications
          </button>
        </>
      )}
      {support.permission === 'granted' && (
        <div className="form-actions">
          <button type="button" onClick={() => void sendTest()}>
            Send test notification
          </button>
          {testResult && (
            <p className="helper" role="status">
              {testResult}
            </p>
          )}
        </div>
      )}

      <ul className="reminder-list">
        {reminders.map((r) => (
          <li key={r.id} className="reminder">
            <label className="check">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => {
                  // Read the value now: React resets a controlled input before async code runs.
                  const enabled = e.target.checked
                  void updateReminder(r.id, () => ({ enabled }))
                }}
              />
              {r.title}
            </label>
            {r.enabled && (
              <>
                <div className="field">
                  <label htmlFor={`time-${r.id}`}>Time for {r.title}</label>
                  <input
                    id={`time-${r.id}`}
                    type="time"
                    value={r.timeLocal}
                    onChange={(e) => {
                      const timeLocal = e.target.value
                      if (isValidTime(timeLocal)) void updateReminder(r.id, () => ({ timeLocal }))
                    }}
                  />
                </div>
                <div className="chips days" role="group" aria-label={`Days for ${r.title}`}>
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={r.weekdays.includes(day)}
                      onClick={() =>
                        void updateReminder(r.id, (current) => ({
                          weekdays: current.weekdays.includes(day)
                            ? current.weekdays.filter((d) => d !== day)
                            : [...current.weekdays, day].sort(),
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <h3>Quiet hours</h3>
      <p className="helper">No reminders are shown between these times.</p>
      <div className="field">
        <label htmlFor="quiet-start">Quiet from</label>
        <input
          id="quiet-start"
          type="time"
          value={settings.quietHoursStart ?? ''}
          onChange={(e) => void setQuietHours(e.target.value || undefined, settings.quietHoursEnd)}
        />
      </div>
      <div className="field">
        <label htmlFor="quiet-end">Quiet until</label>
        <input
          id="quiet-end"
          type="time"
          value={settings.quietHoursEnd ?? ''}
          onChange={(e) =>
            void setQuietHours(settings.quietHoursStart, e.target.value || undefined)
          }
        />
      </div>
    </section>
  )
}
