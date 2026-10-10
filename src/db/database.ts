import Dexie, { type Table } from 'dexie'
import type {
  AppSettings,
  BodyMeasurement,
  FoodEntry,
  GymSession,
  NutritionTargets,
  PlannedWorkoutOverride,
  Reminder,
  RunLog,
  SupplementLog,
  UserProfile,
  WaterEntry,
} from '../domain/types.ts'

export const DB_NAME = 'ironstride'

/**
 * Local-first store. Bump the version and add an `.upgrade()` step to change the
 * schema; never delete stores or data in a migration.
 */
export class IronStrideDB extends Dexie {
  profile!: Table<UserProfile, string>
  settings!: Table<AppSettings, string>
  nutritionTargets!: Table<NutritionTargets, string>
  plannedOverrides!: Table<PlannedWorkoutOverride, string>
  gymSessions!: Table<GymSession, string>
  runLogs!: Table<RunLog, string>
  foodEntries!: Table<FoodEntry, string>
  bodyMeasurements!: Table<BodyMeasurement, string>
  supplementLogs!: Table<SupplementLog, string>
  waterEntries!: Table<WaterEntry, string>
  reminders!: Table<Reminder, string>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      nutritionTargets: 'effectiveFrom',
      plannedOverrides: 'id, [weekNumber+dayOfWeek]',
      gymSessions: 'id, date, status',
      runLogs: 'id, date',
      foodEntries: 'id, date, favourite',
      bodyMeasurements: 'id, date',
      supplementLogs: 'id, date',
      waterEntries: 'id, date',
      reminders: 'id',
    })
  }
}

export const db = new IronStrideDB()
