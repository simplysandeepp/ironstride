import { daysBetween, type DateKey } from '../../domain/dates.ts'
import { calculateDailyNutrition, type MacroTotals } from '../../domain/nutrition.ts'
import {
  getPlannedSessions,
  getPlannedWorkoutsForDate,
  getProgrammeWeekForDate,
} from '../../domain/planner.ts'
import {
  isGymWorkout,
  isRunWorkout,
  type Programme,
  type ProgrammeWorkout,
} from '../../domain/programme.ts'
import {
  calculateStreak,
  getWeeklyTargetProgress,
  isPlannedSessionDone,
  type CompletedSession,
  type StreakResult,
  type WeeklyTargetProgress,
} from '../../domain/streaks.ts'
import type { FoodEntry, GymSession, NutritionTargets, RunLog } from '../../domain/types.ts'

export type TaskStatus = 'done' | 'in-progress' | 'pending'

export type TodayTask = { workout: ProgrammeWorkout; status: TaskStatus }

export type TodayModel = {
  phase: 'before-start' | 'active' | 'finished'
  weekNumber?: number
  blockName?: string
  isCutback: boolean
  isRestDay: boolean
  tasks: TodayTask[]
  /** The first task still to do, for the main action button. */
  nextTask?: TodayTask
  weekGym: WeeklyTargetProgress
  weekRun: WeeklyTargetProgress
  gymStreak: StreakResult
  runStreak: StreakResult
  nutrition: MacroTotals
  targets?: NutritionTargets
}

type Input = {
  programme: Programme
  startDate: DateKey
  today: DateKey
  gymSessions: readonly GymSession[]
  runLogs: readonly RunLog[]
  foodEntries: readonly FoodEntry[]
  targets?: NutritionTargets
}

const completedGym = (sessions: readonly GymSession[]): CompletedSession[] =>
  sessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({ date: s.date, plannedWorkoutId: s.plannedWorkoutId }))

const completedRuns = (runs: readonly RunLog[]): CompletedSession[] =>
  runs
    .filter((r) => r.completed)
    .map((r) => ({ date: r.date, plannedWorkoutId: r.plannedWorkoutId }))

export function buildTodayModel(input: Input): TodayModel {
  const { programme, startDate, today, gymSessions, runLogs, foodEntries, targets } = input
  const gymDone = completedGym(gymSessions)
  const runDone = completedRuns(runLogs)
  const gymPlanned = getPlannedSessions(programme, startDate, 'gym')
  const runPlanned = getPlannedSessions(programme, startDate, 'run')
  const week = getProgrammeWeekForDate(programme, today, startDate)

  const tasks: TodayTask[] = getPlannedWorkoutsForDate(programme, today, startDate).map(
    (workout) => {
      const session = { id: workout.id, date: today }
      const done = isGymWorkout(workout)
        ? isPlannedSessionDone(session, gymDone)
        : isRunWorkout(workout)
          ? isPlannedSessionDone(session, runDone)
          : false
      const resuming =
        isGymWorkout(workout) &&
        gymSessions.some((s) => s.status === 'in-progress' && s.plannedWorkoutId === workout.id)
      return { workout, status: done ? 'done' : resuming ? 'in-progress' : 'pending' }
    },
  )

  const actionable = tasks.filter((t) => isGymWorkout(t.workout) || isRunWorkout(t.workout))
  const phase: TodayModel['phase'] = week
    ? 'active'
    : daysBetween(startDate, today) < 0
      ? 'before-start'
      : 'finished'

  return {
    phase,
    weekNumber: week?.weekNumber,
    blockName: week?.blockName,
    isCutback: week?.isCutback ?? false,
    isRestDay: phase === 'active' && tasks.length > 0 && actionable.length === 0,
    tasks,
    nextTask: actionable.find((t) => t.status !== 'done'),
    weekGym: getWeeklyTargetProgress(gymPlanned, gymDone, today),
    weekRun: getWeeklyTargetProgress(runPlanned, runDone, today),
    gymStreak: calculateStreak(gymPlanned, gymDone, today),
    runStreak: calculateStreak(runPlanned, runDone, today),
    nutrition: calculateDailyNutrition(foodEntries.filter((f) => f.date === today)),
    targets,
  }
}
