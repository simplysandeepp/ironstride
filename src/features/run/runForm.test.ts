import { describe, expect, it } from 'vitest'
import {
  emptyRunForm,
  plannedRunLogId,
  runToForm,
  runTypeForWorkout,
  toRunLog,
  validateRunForm,
} from './runForm.ts'

const valid = { ...emptyRunForm('2026-10-12', 'easy', 5), duration: '27:30', rpe: '4' }

describe('validateRunForm', () => {
  it('accepts a good form and an optional-only minimal one', () => {
    expect(validateRunForm(valid)).toEqual({})
    expect(validateRunForm({ ...valid, duration: '', rpe: '' })).toEqual({})
  })

  it('explains each problem next to its field', () => {
    const errors = validateRunForm({
      ...valid,
      date: '',
      distanceKm: '0',
      duration: 'abc',
      rpe: '11',
    })
    expect(Object.keys(errors).sort()).toEqual(['date', 'distanceKm', 'duration', 'rpe'])
    expect(validateRunForm({ ...valid, distanceKm: '-3' }).distanceKm).toBeDefined()
    expect(validateRunForm({ ...valid, rpe: '4.5' }).rpe).toBeDefined()
  })
})

describe('toRunLog', () => {
  it('builds a completed run with pace from distance and time', () => {
    const log = toRunLog(valid, { id: 'r1', plannedWorkoutId: 'w1-d1-run', plannedDistanceKm: 5 })
    expect(log).toMatchObject({
      id: 'r1',
      type: 'easy',
      actualDistanceKm: 5,
      durationSeconds: 1650,
      averagePaceSecondsPerKm: 330,
      rpe: 4,
      plannedDistanceKm: 5,
      completed: true,
    })
  })

  it('leaves pace and duration empty when no time was entered', () => {
    const log = toRunLog({ ...valid, duration: '', rpe: '', notes: '  ' }, { id: 'r2' })
    expect(log.durationSeconds).toBeUndefined()
    expect(log.averagePaceSecondsPerKm).toBeUndefined()
    expect(log.notes).toBeUndefined()
  })

  it('round-trips through the form', () => {
    const log = toRunLog({ ...valid, notes: 'felt good' }, { id: 'r3' })
    expect(toRunLog(runToForm(log), { id: 'r3' })).toEqual(log)
  })
})

describe('helpers', () => {
  it('maps planned workout types to run types', () => {
    expect(runTypeForWorkout('interval-run')).toBe('interval')
    expect(runTypeForWorkout('long-run')).toBe('long')
    expect(runTypeForWorkout('gym')).toBe('other')
  })

  it('gives each planned run one stable log id', () => {
    expect(plannedRunLogId('w1-d1-run')).toBe('run-w1-d1-run')
  })
})
