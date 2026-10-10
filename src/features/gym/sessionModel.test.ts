import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import type { ProgrammeWorkout } from '../../domain/programme.ts'
import {
  addSet,
  canFinish,
  completedSetCount,
  createSessionFromWorkout,
  finishSession,
  parseNumberInput,
  updateSet,
} from './sessionModel.ts'

let n = 0
const id = () => `id-${++n}`
const upperA = DEFAULT_PROGRAMME.weeks[0].workouts.find((w) => w.type === 'gym') as ProgrammeWorkout

describe('createSessionFromWorkout', () => {
  it('lays out the planned exercises and sets, in progress, with names snapshotted', () => {
    const s = createSessionFromWorkout(upperA, '2026-10-12', '2026-10-12T07:00:00Z', id)
    expect(s.status).toBe('in-progress')
    expect(s.plannedWorkoutId).toBe(upperA.id)
    expect(s.exercises).toHaveLength(upperA.exercises!.length)
    expect(s.exercises[0].exerciseNameSnapshot).toBe('Barbell bench press')
    expect(s.exercises[0].sets).toHaveLength(2) // week 1 uses 2 working sets
    expect(s.exercises.every((e) => e.sets.every((x) => !x.completed))).toBe(true)
  })
})

describe('editing', () => {
  const base = createSessionFromWorkout(upperA, '2026-10-12', '2026-10-12T07:00:00Z', id)

  it('updates one set without touching the original or other sets', () => {
    const next = updateSet(base, 0, 1, { loadKg: 40, reps: 8, completed: true })
    expect(next.exercises[0].sets[1]).toMatchObject({ loadKg: 40, reps: 8, completed: true })
    expect(next.exercises[0].sets[0].completed).toBe(false)
    expect(base.exercises[0].sets[1].completed).toBe(false)
  })

  it('adds a numbered set', () => {
    const next = addSet(base, 0, id)
    expect(next.exercises[0].sets).toHaveLength(3)
    expect(next.exercises[0].sets[2].setNumber).toBe(3)
  })
})

describe('finishing', () => {
  const base = createSessionFromWorkout(upperA, '2026-10-12', '2026-10-12T07:00:00Z', id)

  it('refuses to finish an empty session', () => {
    expect(canFinish(base)).toMatchObject({ ok: false })
  })

  it('finishes with at least one completed set and stamps the time', () => {
    const logged = updateSet(base, 0, 0, { completed: true })
    expect(completedSetCount(logged)).toBe(1)
    expect(canFinish(logged)).toEqual({ ok: true })
    const done = finishSession(logged, '2026-10-12T08:00:00Z')
    expect(done).toMatchObject({ status: 'completed', finishedAt: '2026-10-12T08:00:00Z' })
  })
})

describe('parseNumberInput', () => {
  it('handles blanks, junk and negatives safely', () => {
    expect(parseNumberInput('42.5')).toBe(42.5)
    expect(parseNumberInput('')).toBeUndefined()
    expect(parseNumberInput('abc')).toBeUndefined()
    expect(parseNumberInput('-5')).toBeUndefined()
  })
})
