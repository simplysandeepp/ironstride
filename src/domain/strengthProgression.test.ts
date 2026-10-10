import { describe, expect, it } from 'vitest'
import { getProgressionSuggestion, type SetResult } from './strengthProgression.ts'

const sets = (load: number, reps: number[]): SetResult[] =>
  reps.map((r) => ({ loadKg: load, reps: r, completed: true }))

const RANGE: [number, number] = [8, 12]

describe('getProgressionSuggestion', () => {
  it('suggests a small increase only when every set hits the top of the range', () => {
    const s = getProgressionSuggestion(sets(40, [10, 9, 8]), sets(40, [12, 12, 12]), RANGE)
    expect(s.action).toBe('increase')
    expect(s.nextLoadKg).toBe(42.5)
  })

  it('keeps the load while reps are still climbing', () => {
    const s = getProgressionSuggestion(sets(40, [9, 8, 8]), sets(40, [10, 9, 9]), RANGE)
    expect(s).toMatchObject({ action: 'keep', nextLoadKg: 40 })
  })

  it('does not suggest an increase if one set missed the top', () => {
    const s = getProgressionSuggestion([], sets(40, [12, 12, 11]), RANGE)
    expect(s.action).toBe('keep')
  })

  it('suggests a lighter load after a sharp drop in reps', () => {
    const s = getProgressionSuggestion(sets(40, [12, 11, 10]), sets(40, [7, 6, 5]), RANGE)
    expect(s.action).toBe('reduce')
    expect(s.nextLoadKg).toBe(37.5)
  })

  it('ignores incomplete sets and handles empty input', () => {
    expect(getProgressionSuggestion([], [], RANGE).action).toBe('keep')
    const incomplete: SetResult[] = [{ loadKg: 40, reps: 12, completed: false }]
    expect(getProgressionSuggestion([], incomplete, RANGE).action).toBe('keep')
  })

  it('respects a custom increment', () => {
    expect(getProgressionSuggestion([], sets(100, [12, 12]), RANGE, 5).nextLoadKg).toBe(105)
  })
})
