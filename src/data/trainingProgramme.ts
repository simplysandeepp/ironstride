import type {
  BlockId,
  DayOfWeek,
  PlannedExercise,
  Programme,
  ProgrammeWeek,
  ProgrammeWorkout,
} from '../domain/programme.ts'

/**
 * The default 26-week programme, built from the plain tables below.
 * It is a starting template, not a prescription: nothing here is stored per user.
 */

const MON: DayOfWeek = 1
const TUE: DayOfWeek = 2
const WED: DayOfWeek = 3
const THU: DayOfWeek = 4
const FRI: DayOfWeek = 5
const SAT: DayOfWeek = 6
const SUN: DayOfWeek = 0

const CUTBACK_WEEKS: readonly number[] = [4, 8, 12, 16, 20, 24]

/** Planned distance in km per week: easy, interval, tempo, long (warm-up and cool-down included). */
const RUN_KM: readonly (readonly [number, number, number, number])[] = [
  [4, 4, 4, 7], // 1
  [4, 4, 4.5, 8], // 2
  [4.5, 4.5, 4.5, 8.5], // 3
  [4, 4, 4, 7], // 4 cutback
  [5, 5, 5, 9], // 5
  [5, 5, 5, 10], // 6
  [6, 5, 5, 10], // 7
  [5, 4, 4, 8], // 8 cutback
  [6, 5, 5, 11], // 9
  [6, 5, 5, 12], // 10
  [7, 5, 5.5, 12], // 11
  [5, 4, 4.5, 9], // 12 cutback
  [6.5, 5, 5.5, 12], // 13
  [7, 5.5, 5.5, 13], // 14
  [7, 5.5, 5.5, 14], // 15
  [5, 4.5, 5, 10], // 16 cutback
  [7, 6, 6, 14], // 17
  [7.5, 6, 6, 15], // 18
  [8, 6, 6, 15], // 19
  [6, 5, 5, 11], // 20 cutback
  [7, 5.5, 6, 13], // 21
  [7, 6, 6, 14], // 22
  [7, 6, 6, 13], // 23
  [6, 5, 5, 11], // 24 cutback
  [6, 5, 5, 12], // 25
  [5, 4, 4, 10], // 26
]

/** Interval session per week. One variable (reps or distance) changes at a time. */
const INTERVALS: readonly string[] = [
  '6 × 400 m',
  '6 × 400 m',
  '6 × 400 m',
  '4 × 400 m',
  '6 × 400 m',
  '7 × 400 m',
  '8 × 400 m',
  '5 × 400 m',
  '5 × 600 m',
  '5 × 600 m',
  '6 × 600 m',
  '4 × 600 m',
  '6 × 600 m',
  '7 × 600 m',
  '7 × 600 m',
  '5 × 600 m',
  '4 × 800 m',
  '5 × 800 m',
  '5 × 800 m',
  '4 × 800 m',
  '5 × 800 m',
  '6 × 800 m',
  '6 × 800 m',
  '4 × 800 m',
  '5 × 800 m',
  '5 × 400 m',
]

const TEMPO: readonly string[] = [
  '2 × 8 min',
  '2 × 8 min',
  '2 × 9 min',
  '1 × 12 min',
  '2 × 10 min',
  '2 × 10 min',
  '2 × 12 min',
  '1 × 12 min',
  '2 × 12 min',
  '1 × 15 min',
  '1 × 18 min',
  '1 × 12 min',
  '1 × 18 min',
  '1 × 20 min',
  '1 × 20 min',
  '1 × 15 min',
  '1 × 20 min',
  '1 × 22 min',
  '1 × 25 min',
  '1 × 15 min',
  '1 × 20 min',
  '1 × 25 min',
  '1 × 25 min',
  '1 × 15 min',
  '1 × 20 min',
  '2 × 8 min',
]

const BLOCKS: Record<BlockId, { name: string; focus: string }> = {
  foundation: {
    name: 'Block A: Foundation',
    focus: 'Technique, consistency and easy aerobic volume',
  },
  build: { name: 'Block B: Build', focus: 'Gradual overload and longer quality work' },
  progress: { name: 'Block C: Progress', focus: 'Continued progression with recovery weeks' },
  consolidate: { name: 'Consolidate', focus: 'Hold fitness, reduce fatigue, assess progress' },
}

function blockForWeek(week: number): BlockId {
  if (week <= 8) return 'foundation'
  if (week <= 16) return 'build'
  if (week <= 24) return 'progress'
  return 'consolidate'
}

type SessionKey = 'upperA' | 'lower' | 'upperB'
type Template = readonly (readonly [string, number, number, number])[]

// [exerciseId, sets, minReps, maxReps]. The first exercise is the main lift; it stays fixed in a block.
const GYM: Record<'foundation' | 'later', Record<SessionKey, Template>> = {
  foundation: {
    upperA: [
      ['bench-press', 3, 6, 10],
      ['lat-pulldown', 3, 8, 12],
      ['seated-cable-row', 3, 8, 12],
      ['seated-shoulder-press', 2, 8, 12],
      ['dumbbell-curl', 2, 10, 15],
      ['triceps-pushdown', 2, 10, 15],
    ],
    lower: [
      ['leg-press', 3, 6, 10],
      ['romanian-deadlift', 3, 8, 10],
      ['supported-split-squat', 2, 8, 8],
      ['hamstring-curl', 2, 10, 15],
      ['calf-raise', 3, 12, 15],
    ],
    upperB: [
      ['incline-dumbbell-press', 3, 8, 12],
      ['chest-supported-row', 3, 8, 12],
      ['lat-pulldown', 2, 8, 12],
      ['hip-thrust', 2, 8, 12],
      ['lateral-raise', 2, 12, 15],
      ['face-pull', 2, 12, 15],
      ['plank', 3, 20, 45],
    ],
  },
  later: {
    upperA: [
      ['bench-press', 3, 6, 10],
      ['lat-pulldown', 3, 8, 12],
      ['chest-supported-row', 3, 8, 12],
      ['seated-shoulder-press', 2, 8, 12],
      ['dumbbell-curl', 2, 10, 15],
      ['triceps-pushdown', 2, 10, 15],
    ],
    lower: [
      ['back-squat', 3, 6, 10],
      ['romanian-deadlift', 3, 8, 10],
      ['bulgarian-split-squat', 2, 8, 8],
      ['hamstring-curl', 2, 10, 15],
      ['calf-raise', 3, 12, 15],
    ],
    upperB: [
      ['incline-dumbbell-press', 3, 8, 12],
      ['seated-cable-row', 3, 8, 12],
      ['lat-pulldown', 2, 8, 12],
      ['hip-thrust', 2, 8, 12],
      ['lateral-raise', 2, 12, 15],
      ['rear-delt-fly', 2, 12, 15],
      ['dead-bug', 3, 8, 12],
    ],
  },
}

const SESSION_TITLES: Record<SessionKey, string> = {
  upperA: 'Upper A',
  lower: 'Lower body',
  upperB: 'Upper B + posterior chain',
}

function gymExercises(
  key: SessionKey,
  block: BlockId,
  weekNumber: number,
  isCutback: boolean,
): PlannedExercise[] {
  const template = GYM[block === 'foundation' ? 'foundation' : 'later'][key]
  return template.map(([exerciseId, sets, min, max]) => ({
    exerciseId,
    // Weeks 1-2 teach technique with 2 sets; cutback weeks drop a set (never below 2).
    sets: weekNumber <= 2 ? 2 : isCutback ? Math.max(2, sets - 1) : sets,
    repRange: [min, max],
  }))
}

function buildWeek(weekNumber: number): ProgrammeWeek {
  const [easy, interval, tempo, long] = RUN_KM[weekNumber - 1]
  const isCutback = CUTBACK_WEEKS.includes(weekNumber)
  const block = blockForWeek(weekNumber)
  const id = (day: DayOfWeek, suffix: string) => `w${weekNumber}-d${day}-${suffix}`
  const cutNote = isCutback ? ' Cutback week: keep effort easy.' : ''
  const gymMinutes = isCutback ? 50 : 60

  const gym = (day: DayOfWeek, key: SessionKey): ProgrammeWorkout => ({
    id: id(day, 'gym'),
    weekNumber,
    dayOfWeek: day,
    type: 'gym',
    title: SESSION_TITLES[key],
    notes:
      weekNumber <= 2
        ? '2 working sets per exercise while you learn technique. Stop 2-3 reps before failure.'
        : 'Stop 2-3 reps before failure. Raise the load only after hitting the top of every rep range.',
    estimatedMinutes: gymMinutes,
    exercises: gymExercises(key, block, weekNumber, isCutback),
  })

  const workouts: ProgrammeWorkout[] = [
    gym(MON, 'upperA'),
    {
      id: id(MON, 'run'),
      weekNumber,
      dayOfWeek: MON,
      type: 'easy-run',
      title: 'Easy run',
      notes: `Conversational pace, effort 3-4 out of 10. Do it several hours after lifting, or shorten it if tired.${cutNote}`,
      plannedDistanceKm: easy,
    },
    {
      id: id(TUE, 'run'),
      weekNumber,
      dayOfWeek: TUE,
      type: 'interval-run',
      title: `Intervals: ${INTERVALS[weekNumber - 1]}`,
      notes: `Easy warm-up, ${INTERVALS[weekNumber - 1]} at controlled-fast effort (not all-out) with easy jog or walk recoveries, then easy cool-down.${cutNote}`,
      plannedDistanceKm: interval,
    },
    gym(WED, 'lower'),
    {
      id: id(THU, 'run'),
      weekNumber,
      dayOfWeek: THU,
      type: 'tempo-run',
      title: `Tempo: ${TEMPO[weekNumber - 1]}`,
      notes: `Warm up easily, then ${TEMPO[weekNumber - 1]} at controlled-hard effort (6-7 out of 10), easy jog between blocks, then cool down. If legs feel heavy after Wednesday, swap for an easy run.${cutNote}`,
      plannedDistanceKm: tempo,
    },
    gym(FRI, 'upperB'),
    {
      id: id(SAT, 'run'),
      weekNumber,
      dayOfWeek: SAT,
      type: 'long-run',
      title: 'Long run',
      notes: `Easy, relaxed pace. Walk breaks are fine.${cutNote}`,
      plannedDistanceKm: long,
    },
    {
      id: id(SUN, 'rest'),
      weekNumber,
      dayOfWeek: SUN,
      type: 'rest',
      title: 'Recovery day',
      notes: 'Full rest is part of the plan. Optional easy walk or mobility.',
    },
  ]

  return {
    weekNumber,
    block,
    blockName: BLOCKS[block].name,
    focus: BLOCKS[block].focus,
    isCutback,
    notes: isCutback
      ? 'Recovery week with lower volume. You should finish feeling fresher than you started.'
      : 'If sleep, soreness or mood is poor, shorten the easy run or swap the tempo for an easy run instead of forcing it.',
    workouts,
  }
}

export const DEFAULT_PROGRAMME: Programme = {
  weeks: Array.from({ length: 26 }, (_, i) => buildWeek(i + 1)),
}
