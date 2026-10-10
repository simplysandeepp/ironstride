import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState.tsx'
import { SAMPLE_FOODS } from '../../data/sampleFoods.ts'
import { newId, repositories } from '../../db/repositories.ts'
import { getLocalDateKey } from '../../domain/dates.ts'
import {
  emptyFoodForm,
  foodToForm,
  MEALS,
  toFoodEntry,
  validateFoodForm,
  type FoodFormValues,
} from './foodForm.ts'
import { timeNow } from './foodActions.ts'
import { LoadingCard } from '../../components/LoadingCard.tsx'

type NumberKey = 'quantity' | 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'

const NUMBER_FIELDS: readonly { key: NumberKey; label: string }[] = [
  { key: 'quantity', label: 'Quantity' },
  { key: 'caloriesKcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbohydrates (g)' },
  { key: 'fatG', label: 'Fat (g)' },
  { key: 'fibreG', label: 'Fibre (g, optional)' },
]

type FormProps = {
  initial: FoodFormValues
  entryId: string
  date: string
  keepTime?: string
  isSample: boolean
}

function FoodForm({ initial, entryId, date, keepTime, isSample }: FormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<ReturnType<typeof validateFoodForm>>({})
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<FoodFormValues>) => setValues({ ...values, ...patch })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const found = validateFoodForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    await repositories.foodEntries.save(
      toFoodEntry(values, { id: entryId, date, time: keepTime ?? timeNow() }),
    )
    navigate(`/nutrition?date=${date}`)
  }

  const err = (key: keyof typeof errors) =>
    errors[key] && (
      <p className="field-error" id={`${key}-error`} role="alert">
        {errors[key]}
      </p>
    )

  return (
    <form className="form" onSubmit={submit} noValidate>
      {isSample && (
        <p className="helper">
          Sample values are rough estimates. Check the label or adjust them to your recipe.
        </p>
      )}
      <div className="field">
        <label htmlFor="name">Food name</label>
        <input
          id="name"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {err('name')}
      </div>
      <div className="field">
        <label htmlFor="meal">Meal</label>
        <select
          id="meal"
          value={values.meal}
          onChange={(e) => set({ meal: e.target.value as FoodFormValues['meal'] })}
        >
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="unit">Unit (g, ml, katori, piece…)</label>
        <input id="unit" value={values.unit} onChange={(e) => set({ unit: e.target.value })} />
      </div>
      {NUMBER_FIELDS.map(({ key, label }) => (
        <div className="field" key={key}>
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            inputMode="decimal"
            value={values[key]}
            onChange={(e) => set({ [key]: e.target.value })}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
          {err(key)}
        </div>
      ))}
      <div className="field">
        <label htmlFor="notes">Note (optional)</label>
        <input id="notes" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={values.favourite}
          onChange={(e) => set({ favourite: e.target.checked })}
        />
        Save as favourite
      </label>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          Save food
        </button>
        <button type="button" onClick={() => navigate(`/nutrition?date=${date}`)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function FoodFormScreen() {
  const [params] = useSearchParams()
  const date = params.get('date') ?? getLocalDateKey()
  const editId = params.get('edit') ?? undefined
  const sampleId = params.get('sample') ?? undefined
  const existing = useLiveQuery(
    async () => ({ entry: editId ? await repositories.foodEntries.get(editId) : undefined }),
    [editId],
  )

  if (!existing) return <LoadingCard />
  if (editId) {
    if (!existing.entry)
      return <EmptyState title="Food not found">It may have been deleted.</EmptyState>
    return (
      <FoodForm
        key={editId}
        initial={foodToForm(existing.entry)}
        entryId={editId}
        date={existing.entry.date}
        keepTime={existing.entry.time}
        isSample={false}
      />
    )
  }
  const sample = SAMPLE_FOODS.find((s) => s.id === sampleId)
  return (
    <FoodForm
      key={sampleId ?? 'new'}
      initial={sample ? foodToForm(sample) : emptyFoodForm()}
      entryId={newId()}
      date={date}
      isSample={Boolean(sample)}
    />
  )
}
