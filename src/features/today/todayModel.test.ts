import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRAMME } from '../../data/trainingProgramme.ts'
import type { FoodEntry, GymSession, RunLog } from '../../domain/types.ts'
import { buildTodayModel } from './todayModel.ts'

const START = '2026-10-12' // Monday
const base = {
  programme: DEFAULT_PROGRAMME,
  startDate: START,
  gymSessions: [],
  runLogs: [],
  foodEntries: [],
}

const gymSession = (over: Partial<GymSession> = {}): GymSession => ({
  id: 'g1',
  date: '2026-10-12',
  title: 'Upper A',
  status: 'completed',
  exercises: [],
  plannedWorkoutId: 'w1-d1-gym',
  ...over,
})

const run = (over: Partial<RunLog> = {}): RunLog => ({
  id: 'r1',
  date: '2026-10-12',
  type: 'easy',
  actualDistanceKm: 4,
  completed: true,
  plannedWorkoutId: 'w1-d1-run',
  ...over,
})

describe('buildTodayModel', () => {
  it('lists both Monday tasks as pending with the first as the next action', () => {
    const m = buildTodayModel({ ...base, today: START })
    expect(m.phase).toBe('active')
    expect(m.weekNumber).toBe(1)
    expect(m.tasks.map((t) => [t.workout.type, t.status])).toEqual([
      ['gym', 'pending'],
      ['easy-run', 'pending'],
    ])
    expect(m.nextTask?.workout.type).toBe('gym')
  })

  it('marks a task done only after a completed linked log, and advances the next action', () => {
    const m = buildTodayModel({ ...base, today: START, gymSessions: [gymSession()] })
    expect(m.tasks[0].status).toBe('done')
    expect(m.nextTask?.workout.type).toBe('easy-run')
  })

  it('does not treat an in-progress or skipped session as done', () => {
    const inProgress = buildTodayModel({
      ...base,
      today: START,
      gymSessions: [gymSession({ status: 'in-progress' })],
    })
    expect(inProgress.tasks[0].status).toBe('in-progress')
    const skipped = buildTodayModel({
      ...base,
      today: START,
      gymSessions: [gymSession({ status: 'skipped' })],
    })
    expect(skipped.tasks[0].status).toBe('pending')
  })

  it('does not mix up gym and run completion', () => {
    const m = buildTodayModel({ ...base, today: START, runLogs: [run()] })
    expect(m.tasks.map((t) => t.status)).toEqual(['pending', 'done'])
  })

  it('labels Sunday as a rest day with nothing to start', () => {
    const m = buildTodayModel({ ...base, today: '2026-10-18' })
    expect(m.isRestDay).toBe(true)
    expect(m.nextTask).toBeUndefined()
    expect(m.tasks[0].workout.type).toBe('rest')
  })

  it('reports before-start and finished phases with no tasks', () => {
    expect(buildTodayModel({ ...base, today: '2026-10-11' }).phase).toBe('before-start')
    const finished = buildTodayModel({ ...base, today: '2027-04-20' })
    expect(finished.phase).toBe('finished')
    expect(finished.tasks).toEqual([])
  })

  it('computes weekly progress and streaks from completed logs', () => {
    const m = buildTodayModel({
      ...base,
      today: '2026-10-14',
      gymSessions: [gymSession()],
      runLogs: [run(), run({ id: 'r2', date: '2026-10-13', plannedWorkoutId: 'w1-d2-run' })],
    })
    expect(m.weekGym).toEqual({ planned: 3, completed: 1, remaining: 2 })
    expect(m.weekRun).toEqual({ planned: 4, completed: 2, remaining: 2 })
    expect(m.runStreak.current).toBe(2)
    expect(m.gymStreak.current).toBe(1)
  })

  it('sums only the food entries logged today', () => {
    const food = (date: string, kcal: number): FoodEntry => ({
      id: date + kcal,
      date,
      meal: 'lunch',
      name: 'Dal',
      quantity: 1,
      unit: 'bowl',
      caloriesKcal: kcal,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
    })
    const m = buildTodayModel({
      ...base,
      today: START,
      foodEntries: [food(START, 300), food('2026-10-11', 900)],
    })
    expect(m.nutrition.caloriesKcal).toBe(300)
  })
})
