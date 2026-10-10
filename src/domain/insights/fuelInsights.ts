import { addDays, getLastNDays, type DateKey } from '../dates.ts'
import { calculateDailyNutrition } from '../nutrition.ts'
import type {
  BodyMeasurement,
  FoodEntry,
  MealType,
  NutritionTargets,
  SupplementLog,
  WaterEntry,
} from '../types.ts'
import { getWeeklyAverages } from '../weightTrend.ts'

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** The targets in force on a date: the latest one effective on or before it. */
export function targetForDate(
  targets: readonly NutritionTargets[],
  date: DateKey,
): NutritionTargets | undefined {
  return [...targets]
    .filter((t) => t.effectiveFrom <= date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .at(-1)
}

// ───────── Intake ─────────

export type DayIntake = {
  date: DateKey
  logged: boolean
  caloriesKcal: number
  proteinG: number
  targetKcal?: number
  targetProteinG?: number
}

export type IntakeSummary = {
  days: DayIntake[]
  daysLogged: number
  /** Averages over days that have food logged, so a skipped day does not read as fasting. */
  avgKcal: number | null
  avgProteinG: number | null
  proteinHitDays: number
  calorieOnTargetDays: number
}

export const PROTEIN_HIT_RATIO = 0.9
export const CALORIE_BAND = 0.1

export function getIntakeSummary(
  entries: readonly FoodEntry[],
  targets: readonly NutritionTargets[],
  today: DateKey,
  days = 7,
): IntakeSummary {
  const perDay: DayIntake[] = getLastNDays(today, days).map((date) => {
    const dayEntries = entries.filter((e) => e.date === date)
    const totals = calculateDailyNutrition(dayEntries)
    const t = targetForDate(targets, date)
    return {
      date,
      logged: dayEntries.length > 0,
      caloriesKcal: totals.caloriesKcal,
      proteinG: totals.proteinG,
      targetKcal: t?.caloriesKcal,
      targetProteinG: t?.proteinG,
    }
  })
  const logged = perDay.filter((d) => d.logged)
  const avg = (pick: (d: DayIntake) => number) =>
    logged.length ? round1(logged.reduce((s, d) => s + pick(d), 0) / logged.length) : null
  return {
    days: perDay,
    daysLogged: logged.length,
    avgKcal: logged.length ? Math.round(avg((d) => d.caloriesKcal)!) : null,
    avgProteinG: avg((d) => d.proteinG),
    proteinHitDays: logged.filter(
      (d) => d.targetProteinG && d.proteinG >= d.targetProteinG * PROTEIN_HIT_RATIO,
    ).length,
    calorieOnTargetDays: logged.filter(
      (d) => d.targetKcal && Math.abs(d.caloriesKcal - d.targetKcal) <= d.targetKcal * CALORIE_BAND,
    ).length,
  }
}

export type MacroSplit = { proteinPct: number; carbsPct: number; fatPct: number }

/** Share of macro energy (4 kcal/g protein and carbs, 9 kcal/g fat). Null with no food logged. */
export function getMacroSplit(
  entries: readonly FoodEntry[],
  today: DateKey,
  days = 7,
): MacroSplit | null {
  const recent = entries.filter((e) => e.date >= addDays(today, -(days - 1)) && e.date <= today)
  const p = recent.reduce((s, e) => s + e.proteinG * 4, 0)
  const c = recent.reduce((s, e) => s + e.carbsG * 4, 0)
  const f = recent.reduce((s, e) => s + e.fatG * 9, 0)
  const total = p + c + f
  if (total <= 0) return null
  return {
    proteinPct: Math.round((p / total) * 100),
    carbsPct: Math.round((c / total) * 100),
    fatPct: Math.round((f / total) * 100),
  }
}

export function targetMacroSplit(
  t: Pick<NutritionTargets, 'proteinG' | 'carbsG' | 'fatG'>,
): MacroSplit {
  const p = t.proteinG * 4
  const c = t.carbsG * 4
  const f = t.fatG * 9
  const total = p + c + f || 1
  return {
    proteinPct: Math.round((p / total) * 100),
    carbsPct: Math.round((c / total) * 100),
    fatPct: Math.round((f / total) * 100),
  }
}

export type MealProtein = { meal: MealType; grams: number; sharePct: number }

/** Where your protein comes from, by meal, over the last 7 days. */
export function getProteinByMeal(
  entries: readonly FoodEntry[],
  today: DateKey,
  days = 7,
): MealProtein[] {
  const recent = entries.filter((e) => e.date >= addDays(today, -(days - 1)) && e.date <= today)
  const total = recent.reduce((s, e) => s + e.proteinG, 0)
  if (total <= 0) return []
  const byMeal = new Map<MealType, number>()
  for (const e of recent) byMeal.set(e.meal, (byMeal.get(e.meal) ?? 0) + e.proteinG)
  return [...byMeal]
    .map(([meal, grams]) => ({
      meal,
      grams: round1(grams),
      sharePct: Math.round((grams / total) * 100),
    }))
    .sort((a, b) => b.grams - a.grams)
}

// ───────── Supplements and water ─────────

export type Adherence = { taken: number; skipped: number; windowDays: number; share: number }

const MIN_ADHERENCE_DAYS = 3

/**
 * Days a supplement was marked taken over the window. The window starts no earlier than
 * `trackingStart`, so a recent start is not scored against days before you began.
 */
export function getSupplementAdherence(
  logs: readonly SupplementLog[],
  supplement: string,
  today: DateKey,
  trackingStart: DateKey,
  days = 14,
): Adherence | null {
  const from = addDays(today, -(days - 1))
  const start = from > trackingStart ? from : trackingStart
  const windowDays = Math.max(
    0,
    Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1,
  )
  if (windowDays < MIN_ADHERENCE_DAYS) return null
  const mine = logs.filter((l) => l.supplement === supplement && l.date >= start && l.date <= today)
  const taken = new Set(mine.filter((l) => l.status === 'taken').map((l) => l.date)).size
  const skipped = new Set(mine.filter((l) => l.status === 'skipped').map((l) => l.date)).size
  return { taken, skipped, windowDays, share: round2(taken / windowDays) }
}

export type WaterSummary = { daysHit: number; avgMl: number; days: { date: DateKey; ml: number }[] }

export const WATER_HIT_RATIO = 0.9

export function getWaterSummary(
  entries: readonly WaterEntry[],
  targetMl: number,
  today: DateKey,
  days = 7,
): WaterSummary {
  const perDay = getLastNDays(today, days).map((date) => ({
    date,
    ml: entries.filter((e) => e.date === date).reduce((s, e) => s + e.amountMl, 0),
  }))
  return {
    days: perDay,
    daysHit: perDay.filter((d) => targetMl > 0 && d.ml >= targetMl * WATER_HIT_RATIO).length,
    avgMl: Math.round(perDay.reduce((s, d) => s + d.ml, 0) / perDay.length),
  }
}

// ───────── Body ─────────

export type WeightProgress = {
  latestAvgKg: number
  /** Kilograms per week from the last 3 to 4 weekly averages; null with fewer than 3 weeks of data. */
  weeklyRateKg: number | null
  status: 'below range' | 'in range' | 'above range'
  /** How far you are from your starting weight toward the bottom of your target range, 0 to 100. */
  progressPct: number | null
  /** Rough weeks to reach the bottom of the range at the current rate, or null. */
  etaWeeks: number | null
}

const MIN_WEEKS_FOR_RATE = 3
const MIN_RATE_FOR_ETA = 0.05

/** Least-squares slope through the weekly averages (kg per week). */
function slope(values: readonly number[]): number {
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  const num = values.reduce((s, y, x) => s + (x - xMean) * (y - yMean), 0)
  const den = values.reduce((s, _, x) => s + (x - xMean) ** 2, 0)
  return den === 0 ? 0 : num / den
}

export function getWeightProgress(
  measurements: readonly BodyMeasurement[],
  goal: { minKg: number; maxKg: number; startKg: number },
): WeightProgress | null {
  const weekly = getWeeklyAverages(measurements)
  if (weekly.length === 0) return null
  const latest = weekly.at(-1)!.avgKg
  const recent = weekly.slice(-4)
  const rate =
    recent.length >= MIN_WEEKS_FOR_RATE ? round2(slope(recent.map((w) => w.avgKg))) : null
  const status =
    latest < goal.minKg ? 'below range' : latest > goal.maxKg ? 'above range' : 'in range'
  const span = goal.minKg - goal.startKg
  return {
    latestAvgKg: latest,
    weeklyRateKg: rate,
    status,
    progressPct:
      span > 0
        ? Math.round(Math.min(100, Math.max(0, ((latest - goal.startKg) / span) * 100)))
        : null,
    etaWeeks:
      status === 'below range' && rate !== null && rate >= MIN_RATE_FOR_ETA
        ? Math.ceil(round2((goal.minKg - latest) / rate))
        : null,
  }
}

export function getWaistChange(
  measurements: readonly BodyMeasurement[],
): { firstCm: number; latestCm: number; changeCm: number } | null {
  const waists = measurements
    .filter((m) => typeof m.waistCm === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
  if (waists.length < 2) return null
  const first = waists[0].waistCm!
  const latest = waists.at(-1)!.waistCm!
  return { firstCm: first, latestCm: latest, changeCm: round1(latest - first) }
}

// ───────── Energy balance ─────────

export type EnergyEstimate = {
  maintenanceKcal: number
  avgIntakeKcal: number
  weeklyRateKg: number
  loggedDays: number
}

/** About 7700 kcal per kilogram of body weight, a common rule of thumb. */
export const KCAL_PER_KG = 7700
export const MIN_LOGGED_DAYS_FOR_ESTIMATE = 10

/**
 * A rough maintenance estimate: what you eat, minus the energy implied by the weight change.
 * Needs 10 days of food over the last 3 weeks and 3 weeks of weight, and is only a guide because
 * water, salt and creatine move the scale.
 */
export function estimateMaintenance(
  entries: readonly FoodEntry[],
  measurements: readonly BodyMeasurement[],
  today: DateKey,
): EnergyEstimate | null {
  const intake = getIntakeSummary(entries, [], today, 21)
  if (intake.daysLogged < MIN_LOGGED_DAYS_FOR_ESTIMATE || intake.avgKcal === null) return null
  const weekly = getWeeklyAverages(measurements.filter((m) => m.date <= today))
  if (weekly.length < MIN_WEEKS_FOR_RATE) return null
  const rate = slope(weekly.slice(-3).map((w) => w.avgKg))
  return {
    maintenanceKcal: Math.round(intake.avgKcal - (rate * KCAL_PER_KG) / 7),
    avgIntakeKcal: intake.avgKcal,
    weeklyRateKg: round2(rate),
    loggedDays: intake.daysLogged,
  }
}
