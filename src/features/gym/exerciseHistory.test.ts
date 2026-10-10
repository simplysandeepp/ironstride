import { describe, expect, it } from 'vitest'
import type { GymSession } from '../../domain/types.ts'
import { formatSets, getPreviousSets } from './exerciseHistory.ts'

const session = (
  id: string,
  date: string,
  status: GymSession['status'],
  load: number,
  reps: number[],
): GymSession => ({
  id,
  date,
  title: 'Upper A',
  status,
  startedAt: `${date}T07:00:00Z`,
  exercises: [
    {
      exerciseId: 'bench-press',
      exerciseNameSnapshot: 'Bench',
      sets: reps.map((r, i) => ({
        id: `${id}-${i}`,
        setNumber: i + 1,
        loadKg: load,
        reps: r,
        completed: true,
      })),
    },
  ],
})

describe('getPreviousSets', () => {
  const history = [
    session('a', '2026-10-05', 'completed', 40, [8, 8]),
    session('b', '2026-10-12', 'completed', 42.5, [8, 7]),
    session('c', '2026-10-19', 'in-progress', 45, [6]),
  ]

  it('uses the most recent completed session, ignoring in-progress ones', () => {
    expect(getPreviousSets(history, 'bench-press')).toEqual([
      { loadKg: 42.5, reps: 8, completed: true },
      { loadKg: 42.5, reps: 7, completed: true },
    ])
  })

  it('excludes the session being edited', () => {
    expect(getPreviousSets(history, 'bench-press', 'b')[0].loadKg).toBe(40)
  })

  it('returns nothing for an exercise never done or with only skipped records', () => {
    expect(getPreviousSets(history, 'lat-pulldown')).toEqual([])
    const skipped = {
      ...history[0],
      exercises: [{ ...history[0].exercises[0], skippedReason: 'Too tired' }],
    }
    expect(getPreviousSets([skipped], 'bench-press')).toEqual([])
  })
})

describe('formatSets', () => {
  it('groups sets by load', () => {
    expect(
      formatSets([
        { loadKg: 40, reps: 10, completed: true },
        { loadKg: 40, reps: 9, completed: true },
        { loadKg: 37.5, reps: 8, completed: true },
      ]),
    ).toBe('40 kg × 10, 9 · 37.5 kg × 8')
  })

  it('shows bodyweight sets as reps only', () => {
    expect(formatSets([{ reps: 30, completed: true }])).toBe('30 reps')
    expect(formatSets([])).toBe('')
  })
})
