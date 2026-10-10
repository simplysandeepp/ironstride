import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { getExercise } from '../../data/exerciseLibrary.ts'
import { newId, repositories } from '../../db/repositories.ts'
import type { GymSession } from '../../domain/types.ts'
import { addSet, canFinish, finishSession, parseNumberInput, updateSet } from './sessionModel.ts'

function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function SessionEditor({ initial }: { initial: GymSession }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(initial)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState<string>()
  const [finishing, setFinishing] = useState(false)
  const readOnly = session.status === 'completed'

  // Every change is saved immediately so an interrupted workout can be resumed.
  function change(next: GymSession) {
    setSession(next)
    void repositories.gymSessions.save(next)
  }

  async function finish() {
    if (finishing) return
    const check = canFinish(session)
    if (!check.ok) return setError(check.reason)
    setFinishing(true)
    await repositories.gymSessions.save(finishSession(session, new Date().toISOString()))
    navigate('/gym')
  }

  async function discard() {
    await repositories.gymSessions.remove(session.id)
    navigate('/gym')
  }

  return (
    <div className="stack">
      <h2>{session.title}</h2>
      {readOnly && (
        <p className="helper">This workout is finished. You can still correct values.</p>
      )}
      {session.exercises.map((exercise, exerciseIndex) => {
        const planned = getExercise(exercise.exerciseId)
        return (
          <section
            key={exercise.exerciseId}
            className="card"
            aria-labelledby={`ex-${exerciseIndex}`}
          >
            <h3 id={`ex-${exerciseIndex}`}>{exercise.exerciseNameSnapshot}</h3>
            {planned && (
              <p className="helper">
                {planned.repRange[0]}-{planned.repRange[1]} {planned.measure} · rest{' '}
                {formatRest(planned.restSeconds)}
              </p>
            )}
            {exercise.sets.map((set, setIndex) => (
              <div className="set-row" key={set.id}>
                <span className="set-number">Set {set.setNumber}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} load in kg`}
                  placeholder="kg"
                  defaultValue={set.loadKg ?? ''}
                  onChange={(e) =>
                    change(
                      updateSet(session, exerciseIndex, setIndex, {
                        loadKg: parseNumberInput(e.target.value),
                      }),
                    )
                  }
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} reps`}
                  placeholder={planned?.measure === 'seconds' ? 'sec' : 'reps'}
                  defaultValue={set.reps ?? ''}
                  onChange={(e) =>
                    change(
                      updateSet(session, exerciseIndex, setIndex, {
                        reps: parseNumberInput(e.target.value),
                      }),
                    )
                  }
                />
                <input
                  type="checkbox"
                  aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} done`}
                  checked={set.completed}
                  onChange={(e) =>
                    change(
                      updateSet(session, exerciseIndex, setIndex, { completed: e.target.checked }),
                    )
                  }
                />
              </div>
            ))}
            <button type="button" onClick={() => change(addSet(session, exerciseIndex, newId))}>
              Add set
            </button>
          </section>
        )
      })}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {!readOnly && (
          <button
            type="button"
            className="primary"
            onClick={() => void finish()}
            disabled={finishing}
          >
            Finish workout
          </button>
        )}
        {!readOnly && (
          <button type="button" onClick={() => setConfirmDiscard(true)}>
            Discard workout
          </button>
        )}
        <button type="button" onClick={() => navigate('/gym')}>
          {readOnly ? 'Back' : 'Save and leave'}
        </button>
      </div>
      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this workout?"
          message="Everything logged in this session will be deleted."
          confirmLabel="Discard"
          onConfirm={() => void discard()}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  )
}

export function SessionScreen() {
  const { id = '' } = useParams()
  const loaded = useLiveQuery(
    async () => ({ session: await repositories.gymSessions.get(id) }),
    [id],
  )
  if (!loaded) return <EmptyState title="Loading">Opening your workout.</EmptyState>
  if (!loaded.session) {
    return <EmptyState title="Workout not found">It may have been discarded.</EmptyState>
  }
  // Seed once from storage; the editor owns the state after that.
  return <SessionEditor key={loaded.session.id} initial={loaded.session} />
}
