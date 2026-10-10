import type { BackupData } from './backup.ts'

/** "3 gym sessions, 5 runs, ..." for showing what a backup contains. */
export function describeBackup(data: BackupData): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return [
    part(data.gymSessions.length, 'gym session', 'gym sessions'),
    part(data.runLogs.length, 'run', 'runs'),
    part(data.foodEntries.length, 'food entry', 'food entries'),
    part(data.bodyMeasurements.length, 'weight entry', 'weight entries'),
  ].join(', ')
}
