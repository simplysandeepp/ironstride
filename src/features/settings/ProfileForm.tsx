import { useState, type FormEvent } from 'react'
import { validateProfileValues, type ProfileErrors, type ProfileValues } from './profileValues.ts'

type FieldSpec = {
  key: keyof ProfileValues
  label: string
  type: 'date' | 'number'
  unit?: string
  step?: string
}

const FIELDS: readonly FieldSpec[] = [
  { key: 'trainingStartDate', label: 'Training start date', type: 'date' },
  { key: 'currentWeightKg', label: 'Current weight', type: 'number', unit: 'kg', step: '0.1' },
  {
    key: 'targetWeightMinKg',
    label: 'Target weight, from',
    type: 'number',
    unit: 'kg',
    step: '0.1',
  },
  { key: 'targetWeightMaxKg', label: 'Target weight, to', type: 'number', unit: 'kg', step: '0.1' },
  { key: 'heightCm', label: 'Height', type: 'number', unit: 'cm' },
  {
    key: 'weeklyRunBaselineKm',
    label: 'Current weekly running',
    type: 'number',
    unit: 'km',
    step: '0.5',
  },
  {
    key: 'recentLongRunKm',
    label: 'Recent comfortable long run',
    type: 'number',
    unit: 'km',
    step: '0.5',
  },
  { key: 'caloriesKcal', label: 'Daily calories', type: 'number', unit: 'kcal' },
  { key: 'proteinG', label: 'Daily protein', type: 'number', unit: 'g' },
]

type Props = {
  initial: ProfileValues
  submitLabel: string
  onSubmit: (values: ProfileValues) => Promise<void> | void
  secondary?: { label: string; onClick: () => void }
}

export function ProfileForm({ initial, submitLabel, onSubmit, secondary }: Props) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const found = validateProfileValues(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      await onSubmit(values)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {FIELDS.map(({ key, label, type, unit, step }) => {
        const errorId = `${key}-error`
        return (
          <div className="field" key={key}>
            <label htmlFor={key}>
              {label}
              {unit ? ` (${unit})` : ''}
            </label>
            <input
              id={key}
              type={type}
              inputMode={type === 'number' ? 'decimal' : undefined}
              step={step}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              aria-invalid={errors[key] ? true : undefined}
              aria-describedby={errors[key] ? errorId : undefined}
            />
            {errors[key] && (
              <p className="field-error" id={errorId} role="alert">
                {errors[key]}
              </p>
            )}
          </div>
        )
      })}
      <p className="helper">
        Calories and protein are estimates. Check your weight trend over 2-3 weeks and adjust.
      </p>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {submitLabel}
        </button>
        {secondary && (
          <button type="button" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </div>
    </form>
  )
}
