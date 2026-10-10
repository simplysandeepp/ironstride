import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { SAMPLE_FOODS } from '../../data/sampleFoods.ts'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import { addDays, formatDateLong, getLocalDateKey } from '../../domain/dates.ts'
import { calculateDailyNutrition, getRemaining } from '../../domain/nutrition.ts'
import { BodyWeight } from './BodyWeight.tsx'
import { DailyHabits } from './DailyHabits.tsx'
import { addCopy, toggleFavourite } from './foodActions.ts'
import { getRecentFoods, MEALS, mealLabel } from './foodForm.ts'
import { LoadingCard } from '../../components/LoadingCard.tsx'

function Macro({
  label,
  value,
  target,
  unit,
}: {
  label: string
  value: number
  target?: number
  unit: string
}) {
  return (
    <div className="macro">
      <div className="macro-row">
        <span>{label}</span>
        <span>
          <strong>{value}</strong>
          {target !== undefined ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      {target !== undefined && (
        <ProgressBar label={`${label} progress`} value={value} max={target} tone="nutrition" />
      )}
    </div>
  )
}

export function NutritionScreen() {
  const [params, setParams] = useSearchParams()
  const today = getLocalDateKey()
  const date = params.get('date') ?? today
  const [deleting, setDeleting] = useState<string | null>(null)

  const data = useLiveQuery(
    async () => ({
      entries: await repositories.foodEntries.onDate(date),
      all: await db.foodEntries.toArray(),
      targets: await repositories.nutritionTargets.forDate(date),
    }),
    [date],
  )
  if (!data) return <LoadingCard />

  const totals = calculateDailyNutrition(data.entries)
  const remaining = data.targets ? getRemaining(totals, data.targets) : undefined
  const recent = getRecentFoods(data.all)
  const go = (next: string) => setParams(next === today ? {} : { date: next })

  return (
    <div className="stack">
      <section className="card">
        <div className="date-nav">
          <button type="button" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <strong>{date === today ? 'Today' : formatDateLong(date)}</strong>
          <button
            type="button"
            onClick={() => go(addDays(date, 1))}
            aria-label="Next day"
            disabled={date >= today}
          >
            ›
          </button>
        </div>
        <Macro
          label="Calories"
          value={totals.caloriesKcal}
          target={data.targets?.caloriesKcal}
          unit="kcal"
        />
        <Macro label="Protein" value={totals.proteinG} target={data.targets?.proteinG} unit="g" />
        <Macro label="Carbs" value={totals.carbsG} target={data.targets?.carbsG} unit="g" />
        <Macro label="Fat" value={totals.fatG} target={data.targets?.fatG} unit="g" />
        {remaining && (
          <p className="helper">
            {remaining.overBy
              ? 'Above your calorie target today. That is fine; targets are estimates.'
              : `${remaining.caloriesKcal} kcal and ${remaining.proteinG} g protein left.`}
          </p>
        )}
        <Link className="button-link primary" to={`/nutrition/food?date=${date}`}>
          Add food
        </Link>
      </section>

      {MEALS.map(({ value, label }) => {
        const items = data.entries.filter((e) => e.meal === value)
        if (items.length === 0) return null
        return (
          <section className="card" key={value} aria-labelledby={`meal-${value}`}>
            <h2 id={`meal-${value}`}>{label}</h2>
            <ul className="task-list">
              {items.map((e) => (
                <li key={e.id} className="task">
                  <div>
                    <strong>{e.name}</strong>
                    <br />
                    <span className="helper">
                      {e.quantity} {e.unit} · {e.caloriesKcal} kcal · P {e.proteinG} · C {e.carbsG}{' '}
                      · F {e.fatG}
                    </span>
                  </div>
                  <div className="header-actions">
                    <Link
                      className="button-link"
                      to={`/nutrition/food?edit=${e.id}`}
                      aria-label={`Edit ${e.name}`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void addCopy(e, date)}
                      aria-label={`Duplicate ${e.name}`}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(e.id)}
                      aria-label={`Delete ${e.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {data.entries.length === 0 && (
        <EmptyState title="No food logged">
          Add a meal, or tap a recent food below to add it quickly.
        </EmptyState>
      )}

      {recent.length > 0 && (
        <section className="card" aria-labelledby="recent-heading">
          <h2 id="recent-heading">Recent and favourite foods</h2>
          <ul className="task-list">
            {recent.map((e) => (
              <li key={e.id} className="task">
                <div>
                  <strong>
                    {e.favourite ? '★ ' : ''}
                    {e.name}
                  </strong>
                  <br />
                  <span className="helper">
                    {mealLabel(e.meal)} · {e.caloriesKcal} kcal · P {e.proteinG}
                  </span>
                </div>
                <div className="header-actions">
                  <button
                    type="button"
                    onClick={() => void addCopy(e, date)}
                    aria-label={`Add ${e.name}`}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFavourite(e)}
                    aria-label={
                      e.favourite ? `Remove ${e.name} from favourites` : `Favourite ${e.name}`
                    }
                    aria-pressed={Boolean(e.favourite)}
                  >
                    ★
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="samples-heading">
        <h2 id="samples-heading">Sample foods</h2>
        <p className="helper">
          Rough estimates to start from. Always check labels and edit as needed.
        </p>
        <ul className="task-list">
          {SAMPLE_FOODS.map((s) => (
            <li key={s.id} className="task">
              <span>
                {s.name}{' '}
                <span className="helper">
                  ({s.quantity} {s.unit}, ~{s.caloriesKcal} kcal)
                </span>
              </span>
              <Link
                className="button-link"
                to={`/nutrition/food?sample=${s.id}&date=${date}`}
                aria-label={`Use sample ${s.name}`}
              >
                Use
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DailyHabits date={date} />
      <BodyWeight date={date} />

      {deleting && (
        <ConfirmDialog
          title="Delete this food?"
          message="Daily totals will update."
          confirmLabel="Delete"
          onConfirm={() => {
            void repositories.foodEntries.remove(deleting)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
