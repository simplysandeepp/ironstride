import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { LineChart } from '../../components/LineChart.tsx'
import { repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import {
  getWeeklyAverages,
  getWeightTrend,
  suggestCalorieAdjustment,
} from '../../domain/weightTrend.ts'
import {
  acceptCalorieSuggestion,
  bodyMeasurementId,
  dismissSuggestion,
  emptyBodyForm,
  isWaistRising,
  saveMeasurement,
  suggestionKey,
  toMeasurement,
  validateBodyForm,
  type BodyErrors,
  type BodyForm,
} from './bodyWeight.ts'

function Entry({ date, initial }: { date: DateKey; initial: BodyForm }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<BodyErrors>({})
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateBodyForm(form)
    setErrors(found)
    setSaved(false)
    if (Object.keys(found).length > 0) return
    await saveMeasurement(toMeasurement(date, form))
    setSaved(true)
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {(['weightKg', 'waistCm'] as const).map((key) => (
        <div className="field" key={key}>
          <label htmlFor={key}>{key === 'weightKg' ? 'Weight (kg)' : 'Waist (cm, optional)'}</label>
          <input
            id={key}
            inputMode="decimal"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
          {errors[key] && (
            <p className="field-error" id={`${key}-error`} role="alert">
              {errors[key]}
            </p>
          )}
        </div>
      ))}
      <div className="field">
        <label htmlFor="body-notes">Note (optional)</label>
        <input
          id="body-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <button type="submit" className="primary">
        Save measurement
      </button>
      {saved && (
        <p className="helper" role="status">
          Saved.
        </p>
      )}
    </form>
  )
}

export function BodyWeight({ date }: { date: DateKey }) {
  const data = useLiveQuery(async () => ({
    all: await repositories.bodyMeasurements.all(),
    profile: await repositories.profile.get(),
    settings: await repositories.settings.get(),
  }))
  if (!data) return null

  const todays = data.all.find((m) => m.id === bodyMeasurementId(date))
  const trend = getWeightTrend(data.all)
  const weekly = getWeeklyAverages(data.all)
  const suggestion = data.profile
    ? suggestCalorieAdjustment(weekly, {
        targetMaxKg: data.profile.targetWeightMaxKg,
        waistRising: isWaistRising(data.all),
      })
    : null
  const key = suggestionKey(weekly)
  const showSuggestion = suggestion && key && data.settings.dismissedCalorieSuggestion !== key
  const band = data.profile
    ? { min: data.profile.targetWeightMinKg, max: data.profile.targetWeightMaxKg }
    : undefined
  const latest = trend.at(-1)

  return (
    <section className="card" aria-labelledby="body-heading">
      <h2 id="body-heading">Body weight</h2>
      <p className="helper">
        Weight moves day to day with water, food and creatine. Look at the weekly trend, not a
        single morning.
      </p>
      {/* keyed so switching day reloads the saved values */}
      <Entry
        key={`${date}-${todays?.weightKg}-${todays?.waistCm}`}
        date={date}
        initial={emptyBodyForm(todays)}
      />
      {todays && (
        <button
          type="button"
          onClick={() => void repositories.bodyMeasurements.remove(todays.id)}
          aria-label={`Delete measurement for ${date}`}
        >
          Delete this day&apos;s measurement
        </button>
      )}
      <LineChart
        title="Body weight over time"
        unit="kg"
        points={trend.map((t) => ({ date: t.date, value: t.weightKg, avg: t.rollingAvgKg }))}
        band={band}
        summary={
          latest
            ? `Latest ${latest.weightKg} kg${latest.rollingAvgKg ? `, 7-day average ${latest.rollingAvgKg} kg` : ''}. Shaded band is your ${band?.min}-${band?.max} kg range.`
            : 'No weight logged yet. Add a morning weight and your trend appears here.'
        }
      />
      {showSuggestion && (
        <div className="hint" role="region" aria-label="Calorie suggestion">
          <p>{suggestion.reason}</p>
          <div className="form-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void acceptCalorieSuggestion(suggestion, date)}
            >
              Apply {suggestion.deltaKcal > 0 ? '+' : ''}
              {suggestion.deltaKcal} kcal from today
            </button>
            <button type="button" onClick={() => void dismissSuggestion(key)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
