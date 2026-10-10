import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FoodEntry, GymSession, RunLog } from '../domain/types.ts'
import { IronStrideDB } from './database.ts'
import { createRepositories, DEFAULT_SETTINGS, type Repositories } from './repositories.ts'

let repos: Repositories
let counter = 0

beforeEach(() => {
  counter += 1
  repos = createRepositories(new IronStrideDB(`test-${counter}`))
})

const run = (over: Partial<RunLog> = {}): RunLog => ({
  id: 'r1',
  date: '2026-10-10',
  type: 'easy',
  actualDistanceKm: 5,
  completed: true,
  ...over,
})

describe('date repositories', () => {
  it('saves and reads back a record, upserting by id', async () => {
    await repos.runLogs.save(run())
    await repos.runLogs.save(run({ actualDistanceKm: 6 }))
    expect(await repos.runLogs.all()).toHaveLength(1)
    expect((await repos.runLogs.get('r1'))?.actualDistanceKm).toBe(6)
  })

  it('queries by date and by inclusive range, and deletes', async () => {
    await repos.runLogs.save(run({ id: 'a', date: '2026-10-08' }))
    await repos.runLogs.save(run({ id: 'b', date: '2026-10-09' }))
    await repos.runLogs.save(run({ id: 'c', date: '2026-10-10' }))
    expect(await repos.runLogs.onDate('2026-10-09')).toHaveLength(1)
    expect(await repos.runLogs.between('2026-10-08', '2026-10-09')).toHaveLength(2)
    await repos.runLogs.remove('b')
    expect(await repos.runLogs.between('2026-10-08', '2026-10-10')).toHaveLength(2)
  })

  it('stores food entries without changing their values', async () => {
    const food: FoodEntry = {
      id: 'f1',
      date: '2026-10-10',
      meal: 'breakfast',
      name: 'Oats',
      quantity: 80,
      unit: 'g',
      caloriesKcal: 300,
      proteinG: 10,
      carbsG: 54,
      fatG: 5,
    }
    await repos.foodEntries.save(food)
    expect(await repos.foodEntries.get('f1')).toEqual(food)
  })
})

describe('gym sessions', () => {
  it('finds an interrupted in-progress session so it can be resumed', async () => {
    const base: GymSession = {
      id: 's1',
      date: '2026-10-10',
      title: 'Upper A',
      status: 'completed',
      exercises: [],
    }
    await repos.gymSessions.save(base)
    expect(await repos.gymSessions.findInProgress()).toBeUndefined()
    await repos.gymSessions.save({ ...base, id: 's2', status: 'in-progress' })
    expect((await repos.gymSessions.findInProgress())?.id).toBe('s2')
  })
})

describe('settings and targets', () => {
  it('returns defaults until settings are saved', async () => {
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS)
    await repos.settings.save({ ...DEFAULT_SETTINGS, theme: 'light' })
    expect((await repos.settings.get()).theme).toBe('light')
  })

  it('keeps nutrition target history by effective date', async () => {
    await repos.nutritionTargets.save({
      caloriesKcal: 2700,
      proteinG: 130,
      carbsG: 388,
      fatG: 70,
      effectiveFrom: '2026-10-01',
    })
    await repos.nutritionTargets.save({
      caloriesKcal: 2900,
      proteinG: 140,
      carbsG: 420,
      fatG: 75,
      effectiveFrom: '2026-11-01',
    })
    expect((await repos.nutritionTargets.forDate('2026-10-20'))?.caloriesKcal).toBe(2700)
    expect((await repos.nutritionTargets.forDate('2026-11-05'))?.caloriesKcal).toBe(2900)
    expect(await repos.nutritionTargets.forDate('2026-09-01')).toBeUndefined()
  })
})
