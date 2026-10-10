import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import { getPlannedSessions } from '../planner.ts'
import { getMissedPatterns, getPlanAdherence } from './consistency.ts'

const START = '2026-10-12' // Monday of week 1
const gym = getPlannedSessions(DEFAULT_PROGRAMME, START, 'gym')
const runs = getPlannedSessions(DEFAULT_PROGRAMME, START, 'run')
const done = (p: { id: string; date: string }) => ({ date: p.date, plannedWorkoutId: p.id })

describe('getPlanAdherence', () => {
  it('has no percentage until enough sessions are due', () => {
    expect(getPlanAdherence(runs, [], '2026-10-13')).toMatchObject({ due: 1, share: null })
  })

  it('counts completed against due sessions, leaving today open', () => {
    // Week 1 runs: Mon 12, Tue 13, Thu 15, Sat 17. Today is Sat 17, so Sat is still open.
    const r = getPlanAdherence(runs, runs.slice(0, 2).map(done), '2026-10-17')
    expect(r).toEqual({ due: 3, done: 2, share: 0.67 })
  })

  it('counts today once it is done', () => {
    expect(getPlanAdherence(runs, runs.slice(0, 4).map(done), '2026-10-17')).toEqual({
      due: 4,
      done: 4,
      share: 1,
    })
  })

  it('ignores sessions outside the window', () => {
    expect(getPlanAdherence(runs, [], '2027-08-01', 7)).toEqual({ due: 0, done: 0, share: null })
  })
})

describe('judging only from when logging began', () => {
  it('does not count sessions before the first logged one', () => {
    // Everything before Thursday 15 Oct is ignored: only Thu 15 and Sat 17 are due.
    expect(getPlanAdherence(runs, [done(runs[2])], '2026-10-18', 28, '2026-10-15')).toEqual({
      due: 2,
      done: 1,
      share: null,
    })
    expect(getPlanAdherence(runs, [], '2026-10-18', 28)).toMatchObject({ due: 4 })
  })

  it('also limits missed patterns to the period since logging began', () => {
    expect(
      getMissedPatterns(DEFAULT_PROGRAMME, START, [], [], '2026-11-09', 6, '2026-11-09'),
    ).toEqual([])
  })
})

describe('getMissedPatterns', () => {
  const today = '2026-11-09' // end of week 4 plus a day

  it('finds the session type that keeps getting missed', () => {
    // Do everything except the Thursday tempo runs.
    const completedRuns = DEFAULT_PROGRAMME.weeks
      .flatMap((w) => w.workouts)
      .filter((w) => w.type !== 'tempo-run' && w.type.endsWith('run'))
      .map((w) => w.id)
    const planned = runs.map(done).filter((c) => completedRuns.includes(c.plannedWorkoutId))
    const patterns = getMissedPatterns(DEFAULT_PROGRAMME, START, gym.map(done), planned, today)
    expect(patterns.map((p) => p.title)).toEqual(['Tempo run'])
    expect(patterns[0].missed).toBeGreaterThanOrEqual(2)
  })

  it('stays quiet when sessions are done, or only one was missed', () => {
    expect(
      getMissedPatterns(DEFAULT_PROGRAMME, START, gym.map(done), runs.map(done), today),
    ).toEqual([])
    const oneMissed = runs.filter((r) => r.id !== 'w1-d4-run').map(done)
    expect(getMissedPatterns(DEFAULT_PROGRAMME, START, gym.map(done), oneMissed, today)).toEqual([])
  })

  it('does not count today or the future as missed', () => {
    expect(getMissedPatterns(DEFAULT_PROGRAMME, START, [], [], START)).toEqual([])
  })
})
