import { addDays, getWeekStart, type DateKey } from '../dates.ts'
import type { RunLog, RunType } from '../types.ts'

/** Every function here reads only saved, completed runs and says "not enough data" rather than guessing. */
const completed = (runs: readonly RunLog[]) =>
  runs.filter((r) => r.completed && r.actualDistanceKm > 0)
const inRange = (r: RunLog, from: DateKey, to: DateKey) => r.date >= from && r.date <= to
const sumKm = (runs: readonly RunLog[]) => runs.reduce((s, r) => s + r.actualDistanceKm, 0)
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

const EASY_TYPES: readonly RunType[] = ['easy', 'long', 'recovery', 'other']
const HARD_TYPES: readonly RunType[] = ['interval', 'tempo']

// ───────── Training load ─────────

export type LoadZone = 'unknown' | 'lighter' | 'steady' | 'building' | 'spike'

export type LoadRamp = {
  /** Kilometres in the last 7 days, today included. */
  acuteKm: number
  /** Average weekly kilometres over the 4 weeks before that. */
  chronicKm: number
  ratio: number | null
  zone: LoadZone
}

export const RAMP_THRESHOLDS = { lighter: 0.7, building: 1.15, spike: 1.4 } as const
/** The prior 28 days need at least this many runs, or the average would mean nothing. */
const MIN_RUNS_FOR_RAMP = 3

/**
 * Last 7 days against your recent weekly average (an acute:chronic style ratio).
 * Cutback weeks naturally read "lighter"; a sudden jump reads "spike".
 */
export function getLoadRamp(runs: readonly RunLog[], today: DateKey): LoadRamp {
  const done = completed(runs)
  const acute = done.filter((r) => inRange(r, addDays(today, -6), today))
  const prior = done.filter((r) => inRange(r, addDays(today, -34), addDays(today, -7)))
  const acuteKm = round1(sumKm(acute))
  const chronicKm = round1(sumKm(prior) / 4)
  if (prior.length < MIN_RUNS_FOR_RAMP || chronicKm <= 0)
    return { acuteKm, chronicKm, ratio: null, zone: 'unknown' }
  const ratio = round2(acuteKm / chronicKm)
  const zone: LoadZone =
    ratio < RAMP_THRESHOLDS.lighter
      ? 'lighter'
      : ratio <= RAMP_THRESHOLDS.building
        ? 'steady'
        : ratio <= RAMP_THRESHOLDS.spike
          ? 'building'
          : 'spike'
  return { acuteKm, chronicKm, ratio, zone }
}

// ───────── Totals and personal bests ─────────

export type RunTotals = { runCount: number; totalKm: number; last28Km: number; longestKm: number }

export function getRunTotals(runs: readonly RunLog[], today: DateKey): RunTotals {
  const done = completed(runs)
  return {
    runCount: done.length,
    totalKm: round1(sumKm(done)),
    last28Km: round1(sumKm(done.filter((r) => inRange(r, addDays(today, -27), today)))),
    longestKm: done.reduce((m, r) => Math.max(m, r.actualDistanceKm), 0),
  }
}

export type RunBests = {
  longest: { km: number; date: DateKey } | null
  bestWeek: { weekStart: DateKey; km: number } | null
  /** Fastest average pace over a run of at least 3 km, so a short burst does not count. */
  fastestPace: { secPerKm: number; km: number; date: DateKey } | null
}

export const MIN_KM_FOR_PACE_BEST = 3

export function getRunBests(runs: readonly RunLog[]): RunBests {
  const done = completed(runs)
  if (done.length === 0) return { longest: null, bestWeek: null, fastestPace: null }
  const longest = done.reduce((best, r) => (r.actualDistanceKm > best.actualDistanceKm ? r : best))
  const weeks = new Map<DateKey, number>()
  for (const r of done)
    weeks.set(getWeekStart(r.date), (weeks.get(getWeekStart(r.date)) ?? 0) + r.actualDistanceKm)
  const [weekStart, km] = [...weeks].reduce((best, w) => (w[1] > best[1] ? w : best))
  const paced = done.filter(
    (r) => r.averagePaceSecondsPerKm && r.actualDistanceKm >= MIN_KM_FOR_PACE_BEST,
  )
  const fastest = paced.length
    ? paced.reduce((b, r) => (r.averagePaceSecondsPerKm! < b.averagePaceSecondsPerKm! ? r : b))
    : undefined
  return {
    longest: { km: longest.actualDistanceKm, date: longest.date },
    bestWeek: { weekStart, km: round1(km) },
    fastestPace: fastest
      ? {
          secPerKm: Math.round(fastest.averagePaceSecondsPerKm!),
          km: fastest.actualDistanceKm,
          date: fastest.date,
        }
      : null,
  }
}

// ───────── Pace ─────────

export type PacePoint = { date: DateKey; secPerKm: number; km: number; type: RunType }

/** Every run with a recorded pace, oldest first, for a trend chart. */
export function getPaceSeries(runs: readonly RunLog[], types?: readonly RunType[]): PacePoint[] {
  return completed(runs)
    .filter((r) => r.averagePaceSecondsPerKm && (!types || types.includes(r.type)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      secPerKm: Math.round(r.averagePaceSecondsPerKm!),
      km: r.actualDistanceKm,
      type: r.type,
    }))
}

export type PaceTrend = {
  recentSecPerKm: number
  previousSecPerKm: number
  /** Negative means faster. */
  deltaSec: number
  direction: 'faster' | 'slower' | 'about the same'
}

const PACE_NOISE_SEC = 5
const MIN_RUNS_PER_WINDOW = 2
const MIN_PACE_RUN_KM = 2

/** Distance-weighted pace of your easy-effort runs: last 14 days against the 14 before. */
export function getEasyPaceTrend(runs: readonly RunLog[], today: DateKey): PaceTrend | null {
  const usable = completed(runs).filter(
    (r) =>
      EASY_TYPES.includes(r.type) &&
      r.averagePaceSecondsPerKm &&
      r.durationSeconds &&
      r.actualDistanceKm >= MIN_PACE_RUN_KM,
  )
  const window = (from: DateKey, to: DateKey) => {
    const rs = usable.filter((r) => inRange(r, from, to))
    return rs.length < MIN_RUNS_PER_WINDOW
      ? null
      : rs.reduce((s, r) => s + r.durationSeconds!, 0) / sumKm(rs)
  }
  const recent = window(addDays(today, -13), today)
  const previous = window(addDays(today, -27), addDays(today, -14))
  if (recent === null || previous === null) return null
  const deltaSec = Math.round(recent - previous)
  return {
    recentSecPerKm: Math.round(recent),
    previousSecPerKm: Math.round(previous),
    deltaSec,
    direction:
      Math.abs(deltaSec) < PACE_NOISE_SEC ? 'about the same' : deltaSec < 0 ? 'faster' : 'slower',
  }
}

// ───────── Effort ─────────

export type EffortDiscipline = { rated: number; withinEasy: number; share: number }

export const EASY_RPE_CEILING = 4
const MIN_RATED_EASY_RUNS = 3

/** Of the easy runs you rated, how many stayed at a conversational effort (4 out of 10 or less). */
export function getEffortDiscipline(
  runs: readonly RunLog[],
  today: DateKey,
  days = 28,
): EffortDiscipline | null {
  const rated = completed(runs).filter(
    (r) =>
      r.type === 'easy' &&
      typeof r.rpe === 'number' &&
      inRange(r, addDays(today, -(days - 1)), today),
  )
  if (rated.length < MIN_RATED_EASY_RUNS) return null
  const within = rated.filter((r) => r.rpe! <= EASY_RPE_CEILING).length
  return { rated: rated.length, withinEasy: within, share: round2(within / rated.length) }
}

export type EffortTrend = { recent: number; previous: number; delta: number }

/** Average effort on easy runs, last 14 days against the 14 before. A steady rise can mean you need rest. */
export function getEasyEffortTrend(runs: readonly RunLog[], today: DateKey): EffortTrend | null {
  const rated = completed(runs).filter((r) => r.type === 'easy' && typeof r.rpe === 'number')
  const avg = (from: DateKey, to: DateKey) => {
    const rs = rated.filter((r) => inRange(r, from, to))
    return rs.length < MIN_RUNS_PER_WINDOW ? null : rs.reduce((s, r) => s + r.rpe!, 0) / rs.length
  }
  const recent = avg(addDays(today, -13), today)
  const previous = avg(addDays(today, -27), addDays(today, -14))
  if (recent === null || previous === null) return null
  return { recent: round1(recent), previous: round1(previous), delta: round1(recent - previous) }
}

// ───────── Intensity mix ─────────

export type IntensityMix = { totalKm: number; easyKm: number; hardKm: number; easyShare: number }

/** Share of recent kilometres that were easy, long or recovery versus intervals and tempo. */
export function getIntensityMix(
  runs: readonly RunLog[],
  today: DateKey,
  days = 28,
): IntensityMix | null {
  const recent = completed(runs).filter((r) => inRange(r, addDays(today, -(days - 1)), today))
  const easyKm = sumKm(recent.filter((r) => EASY_TYPES.includes(r.type)))
  const hardKm = sumKm(recent.filter((r) => HARD_TYPES.includes(r.type)))
  const totalKm = easyKm + hardKm
  if (totalKm <= 0) return null
  return {
    totalKm: round1(totalKm),
    easyKm: round1(easyKm),
    hardKm: round1(hardKm),
    easyShare: round2(easyKm / totalKm),
  }
}

/** A common endurance guideline is roughly 80% easy running. Used only as a gentle reference. */
export const EASY_SHARE_REFERENCE = 0.8
