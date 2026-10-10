import { describe, expect, it } from 'vitest'
import {
  EXERCISES,
  getExercise,
  getExercisesByCategory,
  getSubstitutions,
} from './exerciseLibrary.ts'

describe('exercise library', () => {
  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has valid rep ranges, rest times and cues for every exercise', () => {
    for (const e of EXERCISES) {
      expect(e.repRange[0], e.id).toBeGreaterThan(0)
      expect(e.repRange[1], e.id).toBeGreaterThanOrEqual(e.repRange[0])
      expect(e.defaultSets, e.id).toBeGreaterThan(0)
      expect(e.restSeconds, e.id).toBeGreaterThanOrEqual(60)
      expect(e.instructions.length, e.id).toBeGreaterThanOrEqual(3)
      expect(e.safetyNote, e.id).not.toBe('')
    }
  })

  it('only references substitutions that exist', () => {
    for (const e of EXERCISES) {
      for (const sub of e.substitutions) {
        const other = getExercise(sub)
        expect(other, `${e.id} -> ${sub}`).toBeDefined()
        expect(sub, e.id).not.toBe(e.id)
      }
    }
  })

  it('covers every movement pattern required by the programme', () => {
    const categories = new Set(EXERCISES.map((e) => e.category))
    for (const c of [
      'chest',
      'vertical-pull',
      'horizontal-pull',
      'shoulders',
      'arms',
      'squat',
      'hinge',
      'hamstrings',
      'glutes',
      'calves',
      'core',
    ]) {
      expect(categories.has(c as never), c).toBe(true)
    }
  })

  it('provides the alternatives named in the spec', () => {
    const pairs: [string, string][] = [
      ['bench-press', 'dumbbell-bench-press'],
      ['lat-pulldown', 'assisted-pull-up'],
      ['back-squat', 'leg-press'],
      ['romanian-deadlift', 'dumbbell-romanian-deadlift'],
      ['bulgarian-split-squat', 'supported-split-squat'],
      ['hip-thrust', 'glute-bridge'],
      ['seated-cable-row', 'chest-supported-row'],
      ['face-pull', 'rear-delt-fly'],
    ]
    for (const [a, b] of pairs) {
      expect(
        getSubstitutions(a).map((e) => e.id),
        a,
      ).toContain(b)
      expect(
        getSubstitutions(b).map((e) => e.id),
        b,
      ).toContain(a)
    }
  })

  it('looks up by id and category', () => {
    expect(getExercise('nope')).toBeUndefined()
    expect(getExercisesByCategory('calves')).toHaveLength(1)
  })
})
