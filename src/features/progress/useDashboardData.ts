import { useLiveQuery } from 'dexie-react-hooks'
import { useProgramme } from '../../app/useProgramme.ts'
import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import type { DateKey } from '../../domain/dates.ts'
import type { InsightInput } from '../../domain/insights/insightCards.ts'
import { getPlannedSessions, type PlannedSession } from '../../domain/planner.ts'
import type { CompletedSession } from '../../domain/streaks.ts'
import { getWaterTarget } from '../nutrition/habits.ts'

export type DashboardData = InsightInput & {
  gymPlanned: PlannedSession[]
  runPlanned: PlannedSession[]
  gymDone: CompletedSession[]
  runDone: CompletedSession[]
}

/** Everything the dashboard needs, read once from local storage. `undefined` while loading, `null` before setup. */
export function useDashboardData(today: DateKey): DashboardData | null | undefined {
  const plan = useProgramme()
  const logs = useLiveQuery(async () => ({
    gymSessions: await db.gymSessions.toArray(),
    runLogs: await db.runLogs.toArray(),
    foodEntries: await db.foodEntries.toArray(),
    bodyMeasurements: await db.bodyMeasurements.toArray(),
    supplementLogs: await db.supplementLogs.toArray(),
    waterEntries: await db.waterEntries.toArray(),
    nutritionTargets: await db.nutritionTargets.toArray(),
    settings: await repositories.settings.get(),
  }))

  if (plan === undefined || !logs) return undefined
  if (plan === null) return null

  const { programme, profile } = plan
  return {
    today,
    profile,
    programme,
    gymSessions: logs.gymSessions,
    runLogs: logs.runLogs,
    foodEntries: logs.foodEntries,
    bodyMeasurements: logs.bodyMeasurements,
    supplementLogs: logs.supplementLogs,
    waterEntries: logs.waterEntries,
    nutritionTargets: logs.nutritionTargets,
    waterTargetMl: getWaterTarget(logs.settings),
    gymPlanned: getPlannedSessions(programme, profile.trainingStartDate, 'gym'),
    runPlanned: getPlannedSessions(programme, profile.trainingStartDate, 'run'),
    gymDone: logs.gymSessions
      .filter((s) => s.status === 'completed')
      .map((s) => ({ date: s.date, plannedWorkoutId: s.plannedWorkoutId })),
    runDone: logs.runLogs
      .filter((r) => r.completed)
      .map((r) => ({ date: r.date, plannedWorkoutId: r.plannedWorkoutId })),
  }
}
