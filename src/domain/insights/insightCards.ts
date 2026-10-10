import type { DateKey } from '../dates.ts'
import { getPlannedSessions } from '../planner.ts'
import type { Programme } from '../programme.ts'
import { formatPace } from '../running.ts'
import type { CompletedSession } from '../streaks.ts'
import type {
  BodyMeasurement,
  FoodEntry,
  GymSession,
  NutritionTargets,
  RunLog,
  SupplementLog,
  UserProfile,
  WaterEntry,
} from '../types.ts'
import { getMissedPatterns, getPlanAdherence } from './consistency.ts'
import {
  estimateMaintenance,
  getIntakeSummary,
  getSupplementAdherence,
  getWaterSummary,
  getWeightProgress,
} from './fuelInsights.ts'
import {
  EASY_SHARE_REFERENCE,
  getEasyEffortTrend,
  getEasyPaceTrend,
  getEffortDiscipline,
  getIntensityMix,
  getLoadRamp,
  getRunBests,
} from './runInsights.ts'
import { getReadyToProgress, getRecentPRs, getStalledLifts } from './strengthInsights.ts'

export type InsightArea = 'run' | 'gym' | 'fuel' | 'body' | 'consistency'
export type InsightTone = 'good' | 'info' | 'watch'

export type Insight = {
  id: string
  area: InsightArea
  tone: InsightTone
  title: string
  detail: string
}

export type InsightInput = {
  today: DateKey
  profile: UserProfile
  /** The plan in use, with the user's edits applied. */
  programme: Programme
  gymSessions: readonly GymSession[]
  runLogs: readonly RunLog[]
  foodEntries: readonly FoodEntry[]
  bodyMeasurements: readonly BodyMeasurement[]
  supplementLogs: readonly SupplementLog[]
  waterEntries: readonly WaterEntry[]
  nutritionTargets: readonly NutritionTargets[]
  waterTargetMl: number
}

/** Thresholds in one place, so wording and behaviour stay in step. */
export const THRESHOLDS = {
  easyEffortShareGood: 0.8,
  easyEffortShareLow: 0.6,
  easyEffortRise: 1,
  intensityEasyLow: 0.7,
  intensityEasyGood: 0.75,
  newLongestRunDays: 14,
  minLoggedDaysForFood: 4,
  proteinGoodDays: 5,
  proteinLowDays: 2,
  calorieLowRatio: 0.9,
  creatineGood: 0.9,
  creatineLow: 0.7,
  waterLowDays: 2,
  rateGradualMin: 0.15,
  rateFast: 0.5,
  rateFlat: 0.1,
  adherenceGood: 0.85,
  adherenceLow: 0.6,
} as const

const T = THRESHOLDS
const WEIGHT_RATE_FLAT = T.rateFlat
const pct = (n: number) => `${Math.round(n * 100)}%`

const TONE_ORDER: Record<InsightTone, number> = { watch: 0, info: 1, good: 2 }

/**
 * Plain-language observations from real records, most useful first. Every rule needs a minimum
 * amount of data, speaks without blame, and never gives medical advice.
 */
export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = []
  const add = (i: Insight) => out.push(i)
  const { today, profile, programme } = input

  runInsights(input, add)
  strengthInsights(input, add)
  fuelInsights(input, add)
  bodyInsights(input, add)

  // Consistency against the plan
  const gymDone: CompletedSession[] = input.gymSessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({ date: s.date, plannedWorkoutId: s.plannedWorkoutId }))
  const runDone: CompletedSession[] = input.runLogs
    .filter((r) => r.completed)
    .map((r) => ({ date: r.date, plannedWorkoutId: r.plannedWorkoutId }))
  const planned = [
    ...getPlannedSessions(programme, profile.trainingStartDate, 'gym'),
    ...getPlannedSessions(programme, profile.trainingStartDate, 'run'),
  ]
  // Only judge consistency from the day the first session was logged. Before that we simply
  // do not know whether sessions were skipped or just not recorded.
  const firstLogged = [...gymDone, ...runDone].map((c) => c.date).sort()[0]
  const adherence = getPlanAdherence(planned, [...gymDone, ...runDone], today, 28, firstLogged)
  if (firstLogged && adherence.share !== null) {
    if (adherence.share >= T.adherenceGood) {
      add({
        id: 'adherence-good',
        area: 'consistency',
        tone: 'good',
        title: 'Strong consistency',
        detail: `You completed ${adherence.done} of ${adherence.due} planned sessions in the last 4 weeks (${pct(adherence.share)}).`,
      })
    } else if (adherence.share < T.adherenceLow) {
      add({
        id: 'adherence-low',
        area: 'consistency',
        tone: 'watch',
        title: 'Several planned sessions were missed',
        detail: `${adherence.done} of ${adherence.due} planned sessions in the last 4 weeks. Life gets busy; trimming or moving a session usually beats skipping several in a row.`,
      })
    }
  }
  const missed = firstLogged
    ? getMissedPatterns(
        programme,
        profile.trainingStartDate,
        gymDone,
        runDone,
        today,
        6,
        firstLogged,
      )
    : []
  for (const p of missed.slice(0, 2)) {
    add({
      id: `missed-${p.key}`,
      area: 'consistency',
      tone: 'info',
      title: `${p.title} keeps slipping`,
      detail: `Missed ${p.missed} of the last ${p.of}. Consider swapping it for an easy run or moving it to a day with more energy, then edit it in the full plan.`,
    })
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

function runInsights(input: InsightInput, add: (i: Insight) => void) {
  const { runLogs, today } = input

  const ramp = getLoadRamp(runLogs, today)
  if (ramp.ratio !== null) {
    const base = `Your last 7 days (${ramp.acuteKm} km) are ${ramp.ratio}x your recent weekly average (${ramp.chronicKm} km).`
    if (ramp.zone === 'spike')
      add({
        id: 'load-spike',
        area: 'run',
        tone: 'watch',
        title: 'Running load jumped',
        detail: `${base} Quick jumps raise the chance of overuse problems, so keep the next few runs easy.`,
      })
    else if (ramp.zone === 'building')
      add({
        id: 'load-building',
        area: 'run',
        tone: 'info',
        title: 'Load is building',
        detail: `${base} A gradual build is the aim; keep an eye on how easy runs feel.`,
      })
    else if (ramp.zone === 'steady')
      add({
        id: 'load-steady',
        area: 'run',
        tone: 'good',
        title: 'Steady training load',
        detail: `${base} That is a sustainable rhythm.`,
      })
    else
      add({
        id: 'load-lighter',
        area: 'run',
        tone: 'info',
        title: 'A lighter week',
        detail: `${base} If this is a planned recovery week, that is exactly right.`,
      })
  }

  const pace = getEasyPaceTrend(runLogs, today)
  if (pace?.direction === 'faster')
    add({
      id: 'pace-faster',
      area: 'run',
      tone: 'good',
      title: 'Easy pace is improving',
      detail: `${Math.abs(pace.deltaSec)} s/km quicker than the 2 weeks before (now ${formatPace(pace.recentSecPerKm)} /km).`,
    })
  if (pace?.direction === 'slower')
    add({
      id: 'pace-slower',
      area: 'run',
      tone: 'info',
      title: 'Easy pace is a little slower',
      detail: `${pace.deltaSec} s/km slower than the 2 weeks before. Heat, hills and tiredness all do this; read it alongside effort.`,
    })

  const effort = getEffortDiscipline(runLogs, today)
  if (effort && effort.share < T.easyEffortShareLow)
    add({
      id: 'easy-not-easy',
      area: 'run',
      tone: 'watch',
      title: 'Easy runs are not very easy',
      detail: `Only ${effort.withinEasy} of ${effort.rated} rated easy runs stayed at effort 4/10 or lower. Slowing down on easy days lets the hard days do their job.`,
    })
  if (effort && effort.share >= T.easyEffortShareGood)
    add({
      id: 'easy-stays-easy',
      area: 'run',
      tone: 'good',
      title: 'Easy days are staying easy',
      detail: `${effort.withinEasy} of ${effort.rated} rated easy runs were conversational (4/10 or lower).`,
    })

  const trend = getEasyEffortTrend(runLogs, today)
  if (trend && trend.delta >= T.easyEffortRise)
    add({
      id: 'easy-effort-up',
      area: 'run',
      tone: 'watch',
      title: 'Easy runs feel harder lately',
      detail: `Average effort on easy runs rose from ${trend.previous} to ${trend.recent} out of 10. That can be a sign you need more rest or sleep.`,
    })

  const mix = getIntensityMix(runLogs, today)
  if (mix && mix.easyShare < T.intensityEasyLow)
    add({
      id: 'mix-hard',
      area: 'run',
      tone: 'info',
      title: 'A lot of hard running',
      detail: `${pct(mix.easyShare)} of the last 4 weeks' distance was easy (about ${pct(EASY_SHARE_REFERENCE)} is a common guideline). Mostly easy running builds the base.`,
    })
  if (mix && mix.easyShare >= T.intensityEasyGood)
    add({
      id: 'mix-good',
      area: 'run',
      tone: 'good',
      title: 'Good mix of easy and hard',
      detail: `${pct(mix.easyShare)} of the last 4 weeks' distance was easy running.`,
    })

  const bests = getRunBests(runLogs)
  if (
    bests.longest &&
    bests.longest.date >= addDaysKey(today, -(T.newLongestRunDays - 1)) &&
    runLogs.filter((r) => r.completed).length >= 3
  ) {
    const earlier = runLogs
      .filter((r) => r.completed && r.date < bests.longest!.date)
      .reduce((m, r) => Math.max(m, r.actualDistanceKm), 0)
    if (bests.longest.km > earlier && earlier > 0)
      add({
        id: 'longest-run',
        area: 'run',
        tone: 'good',
        title: `New longest run: ${bests.longest.km} km`,
        detail: `Your previous longest was ${earlier} km.`,
      })
  }
}

function strengthInsights(input: InsightInput, add: (i: Insight) => void) {
  const { gymSessions, today } = input
  for (const pr of getRecentPRs(gymSessions, today).slice(0, 2)) {
    add({
      id: `pr-${pr.exerciseId}`,
      area: 'gym',
      tone: 'good',
      title: `New best: ${pr.name}`,
      detail: `About ${pr.estimatedOneRepMax} kg as an estimated single (${pr.loadKg} kg x ${pr.reps}).`,
    })
  }
  for (const lift of getReadyToProgress(gymSessions, today).slice(0, 2)) {
    add({
      id: `ready-${lift.exerciseId}`,
      area: 'gym',
      tone: 'info',
      title: `Ready for more weight: ${lift.name}`,
      detail: `Every set reached the top of the rep range at ${lift.loadKg} kg. Try ${lift.nextLoadKg} kg next time if your form was solid.`,
    })
  }
  for (const lift of getStalledLifts(gymSessions).slice(0, 2)) {
    add({
      id: `stalled-${lift.exerciseId}`,
      area: 'gym',
      tone: 'info',
      title: `${lift.name} has levelled off`,
      detail:
        'No improvement in the last 3 sessions. Check sleep and food, or try a small variation at the next block.',
    })
  }
}

function fuelInsights(input: InsightInput, add: (i: Insight) => void) {
  const {
    foodEntries,
    nutritionTargets,
    today,
    supplementLogs,
    waterEntries,
    waterTargetMl,
    profile,
  } = input
  const intake = getIntakeSummary(foodEntries, nutritionTargets, today)

  if (intake.daysLogged > 0 && intake.daysLogged < T.minLoggedDaysForFood) {
    add({
      id: 'log-more',
      area: 'fuel',
      tone: 'info',
      title: 'Log a few more days for sharper insights',
      detail: `Only ${intake.daysLogged} of the last 7 days have food logged, which is too few to draw conclusions.`,
    })
  }
  if (intake.daysLogged >= T.minLoggedDaysForFood) {
    if (intake.proteinHitDays >= T.proteinGoodDays)
      add({
        id: 'protein-good',
        area: 'fuel',
        tone: 'good',
        title: 'Protein on target most days',
        detail: `${intake.proteinHitDays} of ${intake.daysLogged} logged days reached 90% or more of your protein target.`,
      })
    if (intake.proteinHitDays <= T.proteinLowDays)
      add({
        id: 'protein-low',
        area: 'fuel',
        tone: 'watch',
        title: 'Protein is often short',
        detail: `Only ${intake.proteinHitDays} of ${intake.daysLogged} logged days reached 90% of your protein target. Protein is the main nutrition lever for building muscle; soy chunks, tofu and a shake help.`,
      })
    const targets = intake.days.filter((d) => d.logged && d.targetKcal)
    if (targets.length >= T.minLoggedDaysForFood && intake.avgKcal) {
      const avgTarget = targets.reduce((s, d) => s + d.targetKcal!, 0) / targets.length
      if (intake.avgKcal < avgTarget * T.calorieLowRatio)
        add({
          id: 'calories-low',
          area: 'fuel',
          tone: 'info',
          title: 'Eating below your calorie target',
          detail: `About ${intake.avgKcal} kcal on logged days against a target near ${Math.round(avgTarget)}. If your goal is to gain weight, an extra snack is the easiest fix.`,
        })
    }
  }

  // Only comment on creatine once it has been logged at least once; no logs means it is not being tracked.
  const creatineLogs = supplementLogs.filter((l) => l.supplement === 'creatine')
  const creatine = creatineLogs.length
    ? getSupplementAdherence(
        supplementLogs,
        'creatine',
        today,
        earliestSupplementDate(creatineLogs, profile.trainingStartDate),
      )
    : null
  if (creatine && creatine.share >= T.creatineGood)
    add({
      id: 'creatine-good',
      area: 'fuel',
      tone: 'good',
      title: 'Creatine is consistent',
      detail: `Taken on ${creatine.taken} of the last ${creatine.windowDays} days.`,
    })
  if (creatine && creatine.share < T.creatineLow)
    add({
      id: 'creatine-low',
      area: 'fuel',
      tone: 'info',
      title: 'Creatine is patchy',
      detail: `Taken on ${creatine.taken} of the last ${creatine.windowDays} days. It works through daily use, so a reminder in Settings can help.`,
    })

  const water = getWaterSummary(waterEntries, waterTargetMl, today)
  if (water.days.filter((d) => d.ml > 0).length >= 3 && water.daysHit <= T.waterLowDays) {
    add({
      id: 'water-low',
      area: 'fuel',
      tone: 'info',
      title: 'Water target rarely reached',
      detail: `${water.daysHit} of the last 7 days reached about 90% of your water goal (average ${water.avgMl} ml).`,
    })
  }
}

function bodyInsights(input: InsightInput, add: (i: Insight) => void) {
  const { bodyMeasurements, profile, foodEntries, today } = input
  const progress = getWeightProgress(bodyMeasurements, {
    minKg: profile.targetWeightMinKg,
    maxKg: profile.targetWeightMaxKg,
    startKg: profile.currentWeightKg,
  })
  const rate = progress?.weeklyRateKg
  if (progress && rate !== null && rate !== undefined) {
    if (rate > T.rateFast)
      add({
        id: 'weight-fast',
        area: 'body',
        tone: 'watch',
        title: 'Weight is rising quickly',
        detail: `About ${rate} kg a week. Faster gains are more likely to include extra body fat, so check portions. The scale also moves with water, salt and creatine.`,
      })
    else if (rate >= T.rateGradualMin)
      add({
        id: 'weight-gradual',
        area: 'body',
        tone: 'good',
        title: 'Gaining at a gradual pace',
        detail: `About ${rate} kg a week, from your weekly averages. Not all of a gain is muscle, so judge it alongside strength and waist.`,
      })
    else if (Math.abs(rate) < WEIGHT_RATE_FLAT && progress.status === 'below range')
      add({
        id: 'weight-flat',
        area: 'body',
        tone: 'info',
        title: 'Weight has been flat',
        detail: `Your target range starts at ${profile.targetWeightMinKg} kg. If that is still the goal, adding about 150 kcal a day is a sensible first step.`,
      })
    else if (rate <= -WEIGHT_RATE_FLAT && progress.status === 'below range')
      add({
        id: 'weight-down',
        area: 'body',
        tone: 'watch',
        title: 'Weight is trending down',
        detail: `About ${Math.abs(rate)} kg a week, while your target range starts at ${profile.targetWeightMinKg} kg. Check that you are eating enough, especially on training days.`,
      })
    if (progress.etaWeeks)
      add({
        id: 'weight-eta',
        area: 'body',
        tone: 'info',
        title: `About ${progress.etaWeeks} weeks to the start of your range`,
        detail: `At the current pace you would reach ${profile.targetWeightMinKg} kg then. It will shift as your pace does.`,
      })
  }
  const energy = estimateMaintenance(foodEntries, bodyMeasurements, today)
  if (energy)
    add({
      id: 'maintenance',
      area: 'body',
      tone: 'info',
      title: `Rough maintenance estimate: ${energy.maintenanceKcal} kcal`,
      detail: `From ${energy.loggedDays} logged days and your weight trend. Water and salt move the scale, so treat this as a guide rather than a target.`,
    })
}

function earliestSupplementDate(logs: readonly SupplementLog[], fallback: DateKey): DateKey {
  const dates = logs.map((l) => l.date).sort()
  return dates[0] ?? fallback
}

function addDaysKey(key: DateKey, days: number): DateKey {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const AREA_LABELS: Record<InsightArea, string> = {
  run: 'Running',
  gym: 'Strength',
  fuel: 'Fuel',
  body: 'Body',
  consistency: 'Consistency',
}
