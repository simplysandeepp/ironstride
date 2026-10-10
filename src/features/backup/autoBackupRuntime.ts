import { repositories } from '../../db/repositories.ts'
import { updateSettings } from '../nutrition/habits.ts'
import type { AutoBackupDeps } from './autoBackup.ts'
import { loadFolderHandle } from './autoBackupStore.ts'
import { readAllData } from './backupDb.ts'
import { supportsFolderBackup, type DirHandleLike } from './folderBackup.ts'

/** The real browser-backed dependencies for runAutoBackup. */
export const realAutoBackupDeps = (): AutoBackupDeps => ({
  supported: supportsFolderBackup,
  loadHandle: () => loadFolderHandle<DirHandleLike>().catch(() => undefined),
  readAll: readAllData,
  getSettings: () => repositories.settings.get(),
  saveSettings: updateSettings,
  now: () => new Date(),
  appVersion: __APP_VERSION__,
})
