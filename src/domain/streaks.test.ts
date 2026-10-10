import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../data/trainingProgramme.ts'
import { getPlannedSessions, type PlannedSession } from './planner.ts'
import {
  calculateBestStreak,
  calculateGymStreak,
  calculateRunStreak,
  getWeeklyTargetProgress,
  type CompletedSession,
} from './streaks.ts'

const START = '2026-10-12' // Monday of programme week 1
const gymPlanned = getPlannedSessions(DEFAULT_PROGRAMME, START, 'gym')
const runPlanned = getPlannedSessions(DEFAULT_PROGRAMME, START, 'run')
const done = (p: PlannedSession): CompletedSession => ({ date: p.date, plannedWorkoutId: p.id })

describe('planned sessions', () => {
  it('lists 3 gym and 4 run sessions per week for 26 weeks', () => {
    expect(gymPlanned).toHaveLength(78)
    expect(runPlanned).toHaveLength(104)
    expect(gymPlanned[0].date).toBe('2026-10-12')
  })
})

describe('gym streak', () => {
  it('is zero with no data', () => {
    expect(calculateGymStreak([], [], '2026-10-20')).toEqual({ current: 0, best: 0 })
  })

  it('does not break on planned rest days (Thu/Sat/Sun have no gym)', () => {
    // Mon, Wed, Fri of week 1 done; today is Sunday (rest day).
    const completed = gymPlanned.slice(0, 3).map(done)
    expect(calculateGymStreak(gymPlanned, completed, '2026-10-18')).toEqual({ current: 3, best: 3 })
  })

  it('keeps the streak when today is planned but not yet done', () => {
    const completed = gymPlanned.slice(0, 2).map(done)
    // Friday 2026-10-16 is planned today and still pending.
    expect(calculateGymStreak(gymPlanned, completed, '2026-10-16')).toEqual({ current: 2, best: 2 })
  })

  it('breaks on a missed planned session and keeps the best', () => {
    const completed = [gymPlanned[0], gymPlanned[1], gymPlanned[3], gymPlanned[4]].map(done)
    // Skipped gymPlanned[2] (Friday week 1); today is Wednesday of week 2.
    expect(calculateGymStreak(gymPlanned, completed, '2026-10-21')).toEqual({ current: 2, best: 2 })
  })

  it('counts a rescheduled session only when it names the planned one', () => {
    const friday = gymPlanned[2]
    const doneSaturday: CompletedSession = { date: '2026-10-17', plannedWorkoutId: friday.id }
    const unlinkedSaturday: CompletedSession = { date: '2026-10-17' }
    const base = gymPlanned.slice(0, 2).map(done)
    expect(calculateGymStreak(gymPlanned, [...base, doneSaturday], '2026-10-18').current).toBe(3)
    expect(calculateGymStreak(gymPlanned, [...base, unlinkedSaturday], '2026-10-18').current).toBe(
      0,
    )
  })

  it('accepts an unlinked session logged on the planned date', () => {
    const completed: CompletedSession[] = [{ date: gymPlanned[0].date }]
    expect(calculateGymStreak(gymPlanned, completed, '2026-10-12').current).toBe(1)
  })
})

describe('run streak', () => {
  it('is independent of gym sessions', () => {
    const gymOnly = gymPlanned.slice(0, 3).map(done)
    expect(calculateRunStreak(runPlanned, gymOnly, '2026-10-18')).toEqual({ current: 0, best: 0 })
  })

  it('counts consecutive completed planned runs', () => {
    const completed = runPlanned.slice(0, 4).map(done)
    expect(calculateRunStreak(runPlanned, completed, '2026-10-18')).toEqual({ current: 4, best: 4 })
  })

  it('ignores future planned runs', () => {
    expect(calculateRunStreak(runPlanned, [], '2026-10-11')).toEqual({ current: 0, best: 0 })
  })
})

describe('calculateBestStreak', () => {
  it('finds the longest run of completions', () => {
    expect(calculateBestStreak([true, true, false, true, true, true, false])).toBe(3)
    expect(calculateBestStreak([])).toBe(0)
    expect(calculateBestStreak([false, false])).toBe(0)
  })
})

describe('weekly target progress', () => {
  it('shows planned, completed and remaining for the week', () => {
    const completed = [done(runPlanned[0]), done(runPlanned[1])]
    expect(getWeeklyTargetProgress(runPlanned, completed, '2026-10-15')).toEqual({
      planned: 4,
      completed: 2,
      remaining: 2,
    })
  })

  it('is empty outside the programme', () => {
    expect(getWeeklyTargetProgress(gymPlanned, [], '2026-09-01')).toEqual({
      planned: 0,
      completed: 0,
      remaining: 0,
    })
  })
})
