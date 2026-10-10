import type { Table } from 'dexie'
import type { DateKey } from '../domain/dates.ts'
import type {
  AppSettings,
  BodyMeasurement,
  FoodEntry,
  GymSession,
  NutritionTargets,
  RunLog,
  SupplementLog,
  UserProfile,
  WaterEntry,
} from '../domain/types.ts'
import { db as defaultDb, type IronStrideDB } from './database.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  theme: 'dark',
  distanceUnit: 'km',
  weightUnit: 'kg',
  onboardingCompleted: false,
  notificationsEnabled: false,
}

export function newId(): string {
  return crypto.randomUUID()
}

type Dated = { id: string; date: DateKey }

/** Typed access to a date-indexed table. Writes are upserts by stable id. */
function dateRepo<T extends Dated>(table: Table<T, string>) {
  return {
    save: async (record: T): Promise<T> => {
      await table.put(record)
      return record
    },
    get: (id: string) => table.get(id),
    remove: (id: string) => table.delete(id),
    onDate: (date: DateKey) => table.where('date').equals(date).toArray(),
    between: (from: DateKey, to: DateKey) =>
      table.where('date').between(from, to, true, true).toArray(),
    all: () => table.toArray(),
  }
}

export function createRepositories(db: IronStrideDB = defaultDb) {
  return {
    gymSessions: {
      ...dateRepo<GymSession>(db.gymSessions),
      /** The session to offer "resume" for after an interrupted workout. */
      findInProgress: () => db.gymSessions.where('status').equals('in-progress').first(),
    },
    runLogs: dateRepo<RunLog>(db.runLogs),
    foodEntries: dateRepo<FoodEntry>(db.foodEntries),
    bodyMeasurements: dateRepo<BodyMeasurement>(db.bodyMeasurements),
    supplementLogs: dateRepo<SupplementLog>(db.supplementLogs),
    waterEntries: dateRepo<WaterEntry>(db.waterEntries),
    profile: {
      get: () => db.profile.get('local-user'),
      save: async (profile: UserProfile) => {
        await db.profile.put(profile)
        return profile
      },
    },
    settings: {
      get: async (): Promise<AppSettings> => (await db.settings.get('app')) ?? DEFAULT_SETTINGS,
      save: async (settings: AppSettings) => {
        await db.settings.put(settings)
        return settings
      },
    },
    nutritionTargets: {
      save: async (targets: NutritionTargets) => {
        await db.nutritionTargets.put(targets)
        return targets
      },
      /** The targets in force on `date`: the latest one effective on or before it. */
      forDate: async (date: DateKey) =>
        db.nutritionTargets.where('effectiveFrom').belowOrEqual(date).last(),
    },
  }
}

export type Repositories = ReturnType<typeof createRepositories>
export const repositories: Repositories = createRepositories()
