import { formatDateLong, type DateKey } from '../../domain/dates.ts'
import type { ProgrammeWorkout } from '../../domain/programme.ts'
import type { DayActivities } from '../../domain/heatmap.ts'
import { completedSetCount } from '../gym/sessionModel.ts'
import { RUN_TYPE_LABELS } from '../run/runForm.ts'

type Props = { date: DateKey; activities?: DayActivities; planned: readonly ProgrammeWorkout[] }

export function DaySummary({ date, activities, planned }: Props) {
  const gym = activities?.gym ?? []
  const runs = activities?.runs ?? []
  const isRest = planned.length > 0 && planned.every((w) => w.type === 'rest')
  const plannedSessions = planned.filter((w) => w.type !== 'rest')

  return (
    <section className="card" aria-labelledby="day-heading" aria-live="polite">
      <h2 id="day-heading">{formatDateLong(date)}</h2>
      {gym.length === 0 && runs.length === 0 && (
        <p className="helper">
          {isRest
            ? 'Planned rest day. Recovery is part of training.'
            : 'Nothing logged on this day.'}
        </p>
      )}
      <ul className="task-list">
        {gym.map((s) => (
          <li key={s.id}>
            <strong>Gym:</strong> {s.title} · {completedSetCount(s)} sets
          </li>
        ))}
        {runs.map((r) => (
          <li key={r.id}>
            <strong>Run:</strong> {r.actualDistanceKm} km · {RUN_TYPE_LABELS[r.type]}
          </li>
        ))}
      </ul>
      {plannedSessions.length > 0 && (
        <p className="helper">Planned: {plannedSessions.map((w) => w.title).join(', ')}</p>
      )}
    </section>
  )
}
