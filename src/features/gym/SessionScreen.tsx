import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { getExercise, getSubstitutions } from '../../data/exerciseLibrary.ts'
import { newId, repositories } from '../../db/repositories.ts'
import { getProgressionSuggestion } from '../../domain/strengthProgression.ts'
import type { GymSession } from '../../domain/types.ts'
import { formatSets, getPreviousSets } from './exerciseHistory.ts'
import { RestTimer } from './RestTimer.tsx'
import {
  addSet,
  canFinish,
  finishSession,
  PAIN_ADVICE,
  parseNumberInput,
  SKIP_REASONS,
  skipExercise,
  substituteExercise,
  unskipExercise,
  updateSet,
} from './sessionModel.ts'

const formatRest = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

type EditorProps = { initial: GymSession; history: readonly GymSession[] }

function SessionEditor({ initial, history }: EditorProps) {
  const navigate = useNavigate()
  const [session, setSession] = useState(initial)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState<string>()
  const [finishing, setFinishing] = useState(false)
  const [skipping, setSkipping] = useState<number | null>(null)
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
        const previous = getPreviousSets(history, exercise.exerciseId, session.id)
        const suggestion = planned
          ? getProgressionSuggestion(previous, exercise.sets, planned.repRange)
          : undefined
        const hasLogged = exercise.sets.some((s) => s.completed)
        const substitutes = getSubstitutions(exercise.exerciseId)
        const label = exercise.exerciseNameSnapshot
        return (
          <section
            key={`${exercise.exerciseId}-${exerciseIndex}`}
            className="card"
            aria-labelledby={`ex-${exerciseIndex}`}
          >
            <h3 id={`ex-${exerciseIndex}`}>{label}</h3>
            {exercise.substitutedFromId && (
              <p className="helper">Replaces {getExercise(exercise.substitutedFromId)?.name}.</p>
            )}
            {planned && (
              <p className="helper">
                {planned.repRange[0]}-{planned.repRange[1]} {planned.measure} · rest{' '}
                {formatRest(planned.restSeconds)}
              </p>
            )}
            {previous.length > 0 && <p className="helper">Last time: {formatSets(previous)}</p>}

            {exercise.skippedReason ? (
              <>
                <p>Skipped: {exercise.skippedReason}</p>
                {exercise.skippedReason === SKIP_REASONS[0] && (
                  <p className="helper">{PAIN_ADVICE}</p>
                )}
                <button
                  type="button"
                  onClick={() => change(unskipExercise(session, exerciseIndex))}
                >
                  Undo skip
                </button>
              </>
            ) : (
              <>
                {exercise.sets.map((set, setIndex) => (
                  <div className="set-row" key={set.id}>
                    <span className="set-number">Set {set.setNumber}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${label} set ${set.setNumber} load in kg`}
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
                      aria-label={`${label} set ${set.setNumber} reps`}
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
                      aria-label={`${label} set ${set.setNumber} done`}
                      checked={set.completed}
                      onChange={(e) =>
                        change(
                          updateSet(session, exerciseIndex, setIndex, {
                            completed: e.target.checked,
                          }),
                        )
                      }
                    />
                  </div>
                ))}
                {hasLogged && suggestion && <p className="hint">{suggestion.reason}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => change(addSet(session, exerciseIndex, newId))}
                  >
                    Add set
                  </button>
                  {planned && <RestTimer seconds={planned.restSeconds} />}
                  {substitutes.length > 0 && !hasLogged && (
                    <div className="field">
                      <label htmlFor={`sub-${exerciseIndex}`}>Swap for an equivalent</label>
                      <select
                        id={`sub-${exerciseIndex}`}
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          change(substituteExercise(session, exerciseIndex, e.target.value, newId))
                        }
                      >
                        <option value="">Choose…</option>
                        {substitutes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {skipping === exerciseIndex ? (
                    <div className="field">
                      <label htmlFor={`skip-${exerciseIndex}`}>Why skip?</label>
                      <select
                        id={`skip-${exerciseIndex}`}
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return
                          change(skipExercise(session, exerciseIndex, e.target.value))
                          setSkipping(null)
                        }}
                      >
                        <option value="">Choose a reason…</option>
                        {SKIP_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setSkipping(exerciseIndex)}>
                      Skip exercise
                    </button>
                  )}
                </div>
              </>
            )}
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
    async () => ({
      session: await repositories.gymSessions.get(id),
      history: await repositories.gymSessions.all(),
    }),
    [id],
  )
  if (!loaded) return <EmptyState title="Loading">Opening your workout.</EmptyState>
  if (!loaded.session) {
    return <EmptyState title="Workout not found">It may have been discarded.</EmptyState>
  }
  // Seed once from storage; the editor owns the state after that.
  return <SessionEditor key={loaded.session.id} initial={loaded.session} history={loaded.history} />
}
