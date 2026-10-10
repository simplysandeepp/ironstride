import { db } from '../../db/database.ts'
import { repositories } from '../../db/repositories.ts'
import {
  createBackup,
  emptyBackupData,
  TABLE_NAMES,
  type BackupData,
  type BackupFile,
} from './backup.ts'

export async function readAllData(): Promise<BackupData> {
  const data = emptyBackupData()
  for (const table of TABLE_NAMES) {
    data[table] = (await db.table(table).toArray()) as BackupData[typeof table]
  }
  return data
}

/** Builds the export and records when it was made, so the app can remind you to back up. */
export async function exportBackup(
  now: Date = new Date(),
  appVersion?: string,
): Promise<BackupFile> {
  const file = createBackup(await readAllData(), now.toISOString(), appVersion)
  const settings = await repositories.settings.get()
  await repositories.settings.save({ ...settings, lastBackupAt: file.exportedAt })
  return file
}

/**
 * Replaces the database contents with `next` in a single transaction. If anything fails
 * the transaction rolls back and the existing data is left exactly as it was.
 */
export async function writeAllData(next: BackupData): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of TABLE_NAMES) {
      await db.table(table).clear()
      await db.table(table).bulkAdd(next[table])
    }
  })
}

/** Deletes every record. The caller must have confirmed with the user first. */
export async function resetAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of TABLE_NAMES) await db.table(table).clear()
  })
}

export const BACKUP_REMINDER_DAYS = 14

/** True when there is data worth protecting and no recent backup. */
export function isBackupDue(
  lastBackupAt: string | undefined,
  hasData: boolean,
  now: Date = new Date(),
): boolean {
  if (!hasData) return false
  if (!lastBackupAt) return true
  const ageDays = (now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000
  return !(ageDays < BACKUP_REMINDER_DAYS)
}
