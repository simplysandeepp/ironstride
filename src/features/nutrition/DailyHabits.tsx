import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import {
  addWater,
  getSupplements,
  getWaterServing,
  getWaterTarget,
  setSupplementStatus,
  undoLastWater,
  updateSettings,
  type SupplementStatus,
} from './habits.ts'
import { MEAL_IDEAS } from './mealIdeas.ts'

const STATUS_OPTIONS: { value: SupplementStatus | ''; label: string }[] = [
  { value: '', label: 'Not logged' },
  { value: 'taken', label: 'Taken' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'not-applicable', label: 'Not applicable' },
]

export function DailyHabits({ date }: { date: DateKey }) {
  const [managing, setManaging] = useState(false)
  const data = useLiveQuery(
    async () => ({
      settings: await repositories.settings.get(),
      water: await repositories.waterEntries.onDate(date),
      supplements: await repositories.supplementLogs.onDate(date),
    }),
    [date],
  )
  if (!data) return null

  const { settings } = data
  const waterMl = data.water.reduce((s, w) => s + w.amountMl, 0)
  const target = getWaterTarget(settings)
  const serving = getWaterServing(settings)
  const configs = getSupplements(settings)
  const statusOf = (key: string) => data.supplements.find((s) => s.supplement === key)?.status ?? ''

  const saveNumber = (field: 'waterTargetMl' | 'waterServingMl', text: string) => {
    const n = Number(text)
    if (Number.isFinite(n) && n >= 50 && n <= 10000) void updateSettings({ [field]: Math.round(n) })
  }

  return (
    <>
      <section className="card" aria-labelledby="water-heading">
        <h2 id="water-heading">Water</h2>
        <div className="macro-row">
          <span>
            <strong>{waterMl}</strong> / {target} ml
          </span>
        </div>
        <progress aria-label="Water progress" max={target} value={Math.min(waterMl, target)} />
        <div className="form-actions">
          <button type="button" onClick={() => void addWater(date, serving)}>
            Add {serving} ml
          </button>
          <button
            type="button"
            onClick={() => void undoLastWater(date)}
            disabled={data.water.length === 0}
          >
            Undo last
          </button>
        </div>
        <p className="helper">Your water target is a personal goal, not a medical requirement.</p>
      </section>

      <section className="card" aria-labelledby="supp-heading">
        <h2 id="supp-heading">Supplements</h2>
        {configs
          .filter((c) => c.enabled)
          .map((c) => (
            <div className="field" key={c.key}>
              <label htmlFor={`supp-${c.key}`}>
                {c.label} ({c.amount} {c.unit})
              </label>
              <select
                id={`supp-${c.key}`}
                value={statusOf(c.key)}
                onChange={(e) =>
                  void setSupplementStatus(
                    date,
                    c,
                    (e.target.value || null) as SupplementStatus | null,
                  )
                }
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        <p className="helper">Supplements do not replace food.</p>
        <button type="button" onClick={() => setManaging(!managing)} aria-expanded={managing}>
          {managing ? 'Done' : 'Manage supplements and water'}
        </button>
        {managing && (
          <div className="form">
            {configs.map((c) => (
              <label key={c.key} className="check">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) =>
                    void updateSettings({
                      supplements: configs.map((x) =>
                        x.key === c.key ? { ...x, enabled: e.target.checked } : x,
                      ),
                    })
                  }
                />
                Track {c.label}
              </label>
            ))}
            <div className="field">
              <label htmlFor="water-target">Daily water target (ml)</label>
              <input
                id="water-target"
                inputMode="numeric"
                defaultValue={target}
                onBlur={(e) => saveNumber('waterTargetMl', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="water-serving">Water per tap (ml)</label>
              <input
                id="water-serving"
                inputMode="numeric"
                defaultValue={serving}
                onBlur={(e) => saveNumber('waterServingMl', e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {!settings.hideMealIdeas && (
        <section className="card" aria-labelledby="ideas-heading">
          <h2 id="ideas-heading">Meal ideas</h2>
          <p className="helper">Suggestions only. Eat what suits you.</p>
          <ul className="task-list">
            {MEAL_IDEAS.map((m) => (
              <li key={m.meal}>
                <strong>{m.meal}:</strong> {m.idea}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => void updateSettings({ hideMealIdeas: true })}>
            Hide meal ideas
          </button>
        </section>
      )}
      {settings.hideMealIdeas && (
        <button type="button" onClick={() => void updateSettings({ hideMealIdeas: false })}>
          Show meal ideas
        </button>
      )}
    </>
  )
}
