import type { AppSettings } from '../../domain/types.ts'
import type { BackupData } from './backup.ts'
import {
  ensureFolderPermission,
  hasMeaningfulData,
  writeBackupFolder,
  type DirHandleLike,
} from './folderBackup.ts'

export type AutoBackupStatus =
  | 'off'
  | 'unsupported'
  | 'no-folder'
  | 'needs-permission'
  | 'skipped-empty'
  | 'skipped-recent'
  | 'unchanged'
  | 'done'
  | 'protected'
  | 'error'

/** Opening the app often should not rewrite files each time; a couple of minutes is plenty. */
export const MIN_INTERVAL_MS = 2 * 60_000

export type AutoBackupDeps = {
  supported: () => boolean
  loadHandle: () => Promise<DirHandleLike | undefined>
  readAll: () => Promise<BackupData>
  getSettings: () => Promise<AppSettings>
  saveSettings: (patch: Partial<AppSettings>) => Promise<unknown>
  now: () => Date
  appVersion?: string
}

export type AutoBackupOptions = {
  /** "Back up now": ignore the recent-run limit and allow replacing a larger backup. */
  force?: boolean
  /** Used when the app opens: back up even if one ran moments ago. */
  ignoreRecent?: boolean
  /** Only true when called from a tap, because the browser asks for folder access on a gesture. */
  requestPermission?: boolean
}

export const PROTECTED_MESSAGE =
  'This folder already holds a backup with more history than this device. It was not overwritten. Restore it, or choose another folder.'

/**
 * Runs when the app opens (and when it is left). It is not a schedule: nothing runs while the
 * app is closed. Never throws; the result says what happened.
 */
export async function runAutoBackup(
  deps: AutoBackupDeps,
  options: AutoBackupOptions = {},
): Promise<AutoBackupStatus> {
  const settings = await deps.getSettings()
  if (!settings.autoBackupEnabled) return 'off'
  if (!deps.supported()) return 'unsupported'
  const handle = await deps.loadHandle()
  if (!handle) return 'no-folder'

  const now = deps.now()
  if (!options.force && !options.ignoreRecent && settings.lastAutoBackupAt) {
    if (now.getTime() - new Date(settings.lastAutoBackupAt).getTime() < MIN_INTERVAL_MS)
      return 'skipped-recent'
  }

  const permission = await ensureFolderPermission(handle, Boolean(options.requestPermission))
  if (permission !== 'granted') return 'needs-permission'

  try {
    const data = await deps.readAll()
    if (!hasMeaningfulData(data)) return 'skipped-empty'
    const result = await writeBackupFolder(handle, data, now.toISOString(), deps.appVersion, {
      overwriteSmaller: Boolean(options.force),
    })
    if (result === 'protected') {
      await deps.saveSettings({ lastAutoBackupError: PROTECTED_MESSAGE })
      return 'protected'
    }
    await deps.saveSettings({ lastAutoBackupAt: now.toISOString(), lastAutoBackupError: undefined })
    return result
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    await deps.saveSettings({ lastAutoBackupError: `The backup could not be saved (${reason}).` })
    return 'error'
  }
}
