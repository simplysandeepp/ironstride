import {
  createBackup,
  gymToCsv,
  runsToCsv,
  validateBackupFile,
  weightToCsv,
  type BackupData,
  type ValidationResult,
} from './backup.ts'

/** The small slice of the File System Access API we use, so it can be faked in tests. */
export type WritableLike = { write(data: string): Promise<void>; close(): Promise<void> }
export type FileHandleLike = {
  createWritable(): Promise<WritableLike>
  getFile(): Promise<{ text(): Promise<string> }>
}
export type DirHandleLike = {
  name: string
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
}

export const BACKUP_FILE = 'ironstride-backup.json'
export const PREVIOUS_FILE = 'ironstride-backup.previous.json'
export const RUNS_CSV = 'ironstride-runs.csv'
export const GYM_CSV = 'ironstride-gym-sets.csv'
export const WEIGHT_CSV = 'ironstride-body-weight.csv'
export const README_FILE = 'README.txt'

const README = `IronStride backup folder

ironstride-backup.json           Full backup. IronStride rewrites this same file each time you open the app.
ironstride-backup.previous.json  The version before the latest change, kept as a safety copy.
*.csv                            Runs, gym sets and body weight, for spreadsheets.

To restore after reinstalling: open IronStride, choose "Restore from backup folder" and pick this folder.
These files contain personal health data and are not encrypted. Keep this folder private.
`

type PickerWindow = Window & { showDirectoryPicker?: (options?: object) => Promise<DirHandleLike> }

export const supportsFolderBackup = () =>
  typeof window !== 'undefined' &&
  typeof (window as PickerWindow).showDirectoryPicker === 'function'

/** Opens the system folder picker. Must be called from a tap. */
export function pickBackupFolder(): Promise<DirHandleLike> {
  const picker = (window as PickerWindow).showDirectoryPicker
  if (!picker) throw new Error('Folder access is not supported in this browser.')
  return picker.call(window, { id: 'ironstride-backup', mode: 'readwrite' })
}

async function writeText(dir: DirHandleLike, name: string, text: string) {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

async function readText(dir: DirHandleLike, name: string): Promise<string | undefined> {
  try {
    const handle = await dir.getFileHandle(name)
    return await (await handle.getFile()).text()
  } catch {
    return undefined
  }
}

export type PermissionResult = 'granted' | 'prompt' | 'denied'

/** Re-checks (and, only from a tap, re-requests) access to a folder chosen earlier. */
export async function ensureFolderPermission(
  dir: DirHandleLike,
  request: boolean,
): Promise<PermissionResult> {
  try {
    const state = await dir.queryPermission({ mode: 'readwrite' })
    if (state === 'granted' || !request) return state
    return await dir.requestPermission({ mode: 'readwrite' })
  } catch {
    return 'denied'
  }
}

const LOG_TABLES = [
  'gymSessions',
  'runLogs',
  'foodEntries',
  'bodyMeasurements',
  'supplementLogs',
  'waterEntries',
] as const

export const countLogs = (data: BackupData) => LOG_TABLES.reduce((n, t) => n + data[t].length, 0)

/** Anything worth protecting: a profile, plan edits or at least one log. */
export const hasMeaningfulData = (data: BackupData) =>
  data.profile.length + data.plannedOverrides.length + countLogs(data) > 0

const VOLATILE = ['lastBackupAt', 'lastAutoBackupAt', 'lastAutoBackupError']

/** The data without bookkeeping timestamps, so "nothing changed" can be recognised. */
function comparable(data: BackupData) {
  return JSON.stringify({
    ...data,
    settings: data.settings.map((s) =>
      Object.fromEntries(Object.entries(s).filter(([k]) => !VOLATILE.includes(k))),
    ),
  })
}

export type WriteResult = 'done' | 'unchanged' | 'protected'

/**
 * Writes the backup files into the folder, always to the same names.
 * - The old backup is first kept as the .previous file.
 * - Unless `overwriteSmaller`, a populated backup is never replaced by one with no logs at all
 *   (what a freshly reinstalled app looks like).
 * - Each file is written through a stream that swaps in on close, so a failure cannot leave half a file.
 */
export async function writeBackupFolder(
  dir: DirHandleLike,
  data: BackupData,
  exportedAt: string,
  appVersion: string | undefined,
  options: { overwriteSmaller: boolean },
): Promise<WriteResult> {
  const existingText = await readText(dir, BACKUP_FILE)
  const existing = existingText ? safeValidate(existingText) : undefined
  if (existing?.ok) {
    if (comparable(existing.data) === comparable(data)) return 'unchanged'
    if (!options.overwriteSmaller && countLogs(data) === 0 && countLogs(existing.data) > 0)
      return 'protected'
  }
  if (existingText !== undefined && existing?.ok) await writeText(dir, PREVIOUS_FILE, existingText)

  await writeText(
    dir,
    BACKUP_FILE,
    JSON.stringify(createBackup(data, exportedAt, appVersion), null, 2),
  )
  await writeText(dir, RUNS_CSV, runsToCsv(data.runLogs))
  await writeText(dir, GYM_CSV, gymToCsv(data.gymSessions))
  await writeText(dir, WEIGHT_CSV, weightToCsv(data.bodyMeasurements))
  if ((await readText(dir, README_FILE)) === undefined) await writeText(dir, README_FILE, README)
  return 'done'
}

function safeValidate(text: string): ValidationResult {
  try {
    return validateBackupFile(JSON.parse(text))
  } catch {
    return { ok: false, errors: ['The backup file is not valid JSON.'] }
  }
}

/** Finds and checks the backup inside a folder, falling back to the previous copy if needed. */
export async function readBackupFolder(dir: DirHandleLike): Promise<ValidationResult> {
  const main = await readText(dir, BACKUP_FILE)
  if (main === undefined) {
    return {
      ok: false,
      errors: [
        `No IronStride backup was found in "${dir.name}". Look for ${BACKUP_FILE}, usually in the folder you chose before.`,
      ],
    }
  }
  const result = safeValidate(main)
  if (result.ok) return result
  const previous = await readText(dir, PREVIOUS_FILE)
  if (previous !== undefined) {
    const fallback = safeValidate(previous)
    if (fallback.ok) {
      return {
        ...fallback,
        warnings: [
          'The latest backup file could not be read, so the previous copy was used.',
          ...fallback.warnings,
        ],
      }
    }
  }
  return result
}
