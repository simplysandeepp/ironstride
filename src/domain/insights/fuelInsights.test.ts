import { describe, expect, it } from 'vitest'
import type {
  BodyMeasurement,
  FoodEntry,
  NutritionTargets,
  SupplementLog,
  WaterEntry,
} from '../types.ts'
import {
  estimateMaintenance,
  getIntakeSummary,
  getMacroSplit,
  getProteinByMeal,
  getSupplementAdherence,
  getWaistChange,
  getWaterSummary,
  getWeightProgress,
  targetForDate,
  targetMacroSplit,
} from './fuelInsights.ts'

const TODAY = '2026-10-31'
let n = 0
const food = (
  date: string,
  kcal: number,
  protein: number,
  over: Partial<FoodEntry> = {},
): FoodEntry => ({
  id: `f${++n}`,
  date,
  meal: 'lunch',
  name: 'x',
  quantity: 1,
  unit: 'g',
  caloriesKcal: kcal,
  proteinG: protein,
  carbsG: 0,
  fatG: 0,
  ...over,
})
const targets: NutritionTargets[] = [
  { caloriesKcal: 2500, proteinG: 120, carbsG: 350, fatG: 70, effectiveFrom: '2026-10-01' },
  { caloriesKcal: 2800, proteinG: 140, carbsG: 400, fatG: 75, effectiveFrom: '2026-10-29' },
]

describe('targetForDate', () => {
  it('picks the latest target in force, and none before the first', () => {
    expect(targetForDate(targets, '2026-10-15')?.caloriesKcal).toBe(2500)
    expect(targetForDate(targets, '2026-10-29')?.caloriesKcal).toBe(2800)
    expect(targetForDate(targets, '2026-09-01')).toBeUndefined()
    expect(targetForDate([], TODAY)).toBeUndefined()
  })
})

describe('getIntakeSummary', () => {
  it('averages only days with food logged, and scores each day against the target then in force', () => {
    const entries = [
      food('2026-10-27', 2500, 120),
      food('2026-10-28', 2000, 100),
      food('2026-10-30', 2800, 140),
      food('2026-10-31', 1000, 50),
    ]
    const s = getIntakeSummary(entries, targets, TODAY, 7)
    expect(s.days).toHaveLength(7)
    expect(s.daysLogged).toBe(4)
    expect(s.avgKcal).toBe(2075)
    expect(s.proteinHitDays).toBe(2) // 120/120 and 140/140; 100/120 is 83%, 50/140 is 36%
    expect(s.calorieOnTargetDays).toBe(2)
    expect(s.days.find((d) => d.date === '2026-10-30')).toMatchObject({
      targetKcal: 2800,
      logged: true,
    })
  })

  it('does not treat unlogged days as zero intake', () => {
    expect(getIntakeSummary([food('2026-10-31', 2000, 100)], targets, TODAY).avgKcal).toBe(2000)
    expect(getIntakeSummary([], targets, TODAY)).toMatchObject({
      daysLogged: 0,
      avgKcal: null,
      avgProteinG: null,
      proteinHitDays: 0,
    })
  })
})

describe('macros and protein by meal', () => {
  it('computes the energy share of each macro', () => {
    const split = getMacroSplit([food('2026-10-30', 0, 100, { carbsG: 200, fatG: 40 })], TODAY)
    expect(split).toEqual({ proteinPct: 26, carbsPct: 51, fatPct: 23 })
    expect(getMacroSplit([], TODAY)).toBeNull()
    expect(getMacroSplit([food('2026-08-01', 0, 100)], TODAY)).toBeNull()
  })

  it('describes the target split', () => {
    expect(targetMacroSplit({ proteinG: 130, carbsG: 388, fatG: 70 })).toEqual({
      proteinPct: 19,
      carbsPct: 57,
      fatPct: 23,
    })
  })

  it('ranks meals by protein with shares that make sense', () => {
    const out = getProteinByMeal(
      [
        food('2026-10-30', 0, 30, { meal: 'dinner' }),
        food('2026-10-30', 0, 10, { meal: 'breakfast' }),
        food('2026-10-31', 0, 20, { meal: 'dinner' }),
      ],
      TODAY,
    )
    expect(out.map((m) => [m.meal, m.grams, m.sharePct])).toEqual([
      ['dinner', 50, 83],
      ['breakfast', 10, 17],
    ])
    expect(getProteinByMeal([], TODAY)).toEqual([])
  })
})

describe('supplements and water', () => {
  const log = (
    date: string,
    status: SupplementLog['status'],
    supplement = 'creatine',
  ): SupplementLog => ({
    id: `${date}-${supplement}`,
    date,
    supplement,
    amount: 3,
    unit: 'g',
    status,
  })

  it('scores adherence from the day tracking began, not before it', () => {
    const logs = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30']
      .map((d) => log(d, 'taken'))
      .concat([log('2026-10-29', 'skipped')])
    expect(getSupplementAdherence(logs, 'creatine', TODAY, '2026-10-26')).toEqual({
      taken: 4,
      skipped: 1,
      windowDays: 6,
      share: 0.67,
    })
    expect(getSupplementAdherence(logs, 'creatine', TODAY, '2026-09-01')?.windowDays).toBe(14)
  })

  it('stays quiet for a window shorter than 3 days, and counts a day once', () => {
    expect(getSupplementAdherence([], 'creatine', TODAY, '2026-10-30')).toBeNull()
    const dup = [log('2026-10-30', 'taken'), { ...log('2026-10-30', 'taken'), id: 'again' }]
    expect(getSupplementAdherence(dup, 'creatine', TODAY, '2026-10-20')?.taken).toBe(1)
  })

  it('summarises water against the target', () => {
    const water = (date: string, amountMl: number): WaterEntry => ({
      id: `${date}${amountMl}`,
      date,
      amountMl,
    })
    const w = getWaterSummary(
      [
        water('2026-10-31', 3000),
        water('2026-10-30', 1500),
        water('2026-10-30', 1500),
        water('2026-10-29', 1000),
      ],
      3000,
      TODAY,
    )
    expect(w.daysHit).toBe(2)
    expect(w.avgMl).toBe(Math.round(7000 / 7))
    expect(getWaterSummary([], 0, TODAY).daysHit).toBe(0)
  })
})

describe('weight progress', () => {
  const m = (date: string, weightKg: number, waistCm?: number): BodyMeasurement => ({
    id: date,
    date,
    weightKg,
    waistCm,
  })
  const goal = { minKg: 72, maxKg: 75, startKg: 66 }
  const weeks = [
    m('2026-10-05', 66),
    m('2026-10-12', 66.6),
    m('2026-10-19', 67.2),
    m('2026-10-26', 67.8),
  ]

  it('reports status, rate, progress toward the range and a rough ETA', () => {
    const p = getWeightProgress(weeks, goal)!
    expect(p).toMatchObject({
      latestAvgKg: 67.8,
      weeklyRateKg: 0.6,
      status: 'below range',
      progressPct: 30,
    })
    expect(p.etaWeeks).toBe(7)
  })

  it('gives no rate or ETA with fewer than 3 weeks of data', () => {
    expect(getWeightProgress(weeks.slice(0, 2), goal)).toMatchObject({
      weeklyRateKg: null,
      etaWeeks: null,
    })
    expect(getWeightProgress([], goal)).toBeNull()
  })

  it('gives no ETA when weight is flat, and knows when you are in range', () => {
    const flat = [m('2026-10-05', 66), m('2026-10-12', 66), m('2026-10-19', 66.02)]
    expect(getWeightProgress(flat, goal)?.etaWeeks).toBeNull()
    expect(
      getWeightProgress([m('2026-10-05', 73), m('2026-10-12', 73.2), m('2026-10-19', 73.4)], goal),
    ).toMatchObject({ status: 'in range', etaWeeks: null })
    expect(getWeightProgress([m('2026-10-05', 80)], goal)?.status).toBe('above range')
  })

  it('tracks waist change', () => {
    expect(getWaistChange([m('2026-10-05', 66, 78), m('2026-10-26', 67, 79.5)])).toEqual({
      firstCm: 78,
      latestCm: 79.5,
      changeCm: 1.5,
    })
    expect(getWaistChange([m('2026-10-05', 66, 78)])).toBeNull()
  })
})

describe('estimateMaintenance', () => {
  const week = (start: string, kg: number): BodyMeasurement => ({
    id: start,
    date: start,
    weightKg: kg,
  })
  const days = (count: number, kcal: number) =>
    Array.from({ length: count }, (_, i) =>
      food(`2026-10-${String(31 - i).padStart(2, '0')}`, kcal, 100),
    )

  it('subtracts the energy implied by the weight change from what was eaten', () => {
    const est = estimateMaintenance(
      days(14, 2900),
      [week('2026-10-12', 66), week('2026-10-19', 66.4), week('2026-10-26', 66.8)],
      TODAY,
    )!
    expect(est.avgIntakeKcal).toBe(2900)
    expect(est.weeklyRateKg).toBe(0.4)
    expect(est.maintenanceKcal).toBe(Math.round(2900 - (0.4 * 7700) / 7))
  })

  it('needs enough food days and enough weeks of weight', () => {
    const weights = [week('2026-10-12', 66), week('2026-10-19', 66.4), week('2026-10-26', 66.8)]
    expect(estimateMaintenance(days(9, 2900), weights, TODAY)).toBeNull()
    expect(estimateMaintenance(days(14, 2900), weights.slice(0, 2), TODAY)).toBeNull()
  })
})
