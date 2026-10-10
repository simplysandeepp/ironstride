import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { repositories } from '../../db/repositories.ts'
import { exportBackup, isBackupDue, readAllData } from './backupDb.ts'
import { backupFilename, downloadTextFile } from './download.ts'
import { hasMeaningfulData } from './folderBackup.ts'
import { PROTECTED_MESSAGE } from './autoBackup.ts'
import { useAutoBackup } from './useAutoBackup.ts'

/** Shows only what needs the user: a permission tap, a protected folder, a failure, or the daily save reminder. */
export function AutoBackupBanner({ active }: { active: boolean }) {
  const { status, run, declined } = useAutoBackup(active)
  const info = useLiveQuery(async () => {
    const settings = await repositories.settings.get()
    const hasData = hasMeaningfulData(await readAllData())
    return {
      settings,
      dailyReminderDue: isBackupDue(settings.lastBackupAt, hasData, new Date(), 1),
    }
  })

  if (!active || !info) return null
  const { settings, dailyReminderDue } = info

  if (status === 'needs-permission') {
    return (
      <div className="update-prompt" role="status" aria-label="Backup permission">
        <p>
          {declined ? (
            <>
              <strong>Access was not given.</strong> In the browser&apos;s popup, choose{' '}
              <strong>Allow on every visit</strong>, then tap again. If no popup appears, this
              browser cannot keep folder access: use Settings, then Backup, to save a copy yourself.
            </>
          ) : (
            <>
              <strong>Allow backups.</strong> Tap anywhere, then choose{' '}
              <strong>Allow on every visit</strong> so IronStride can save to
              {settings.autoBackupFolderName
                ? ` "${settings.autoBackupFolderName}"`
                : ' your backup folder'}{' '}
              every time you open it, without asking again.
            </>
          )}
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => void run({ requestPermission: true })}
        >
          Allow backups
        </button>
      </div>
    )
  }

  if (status === 'protected') {
    return (
      <div className="update-prompt" role="status" aria-label="Backup not updated">
        <p>{PROTECTED_MESSAGE}</p>
        <Link className="button-link" to="/settings">
          Open backup settings
        </Link>
      </div>
    )
  }

  if (status === 'error' && settings.lastAutoBackupError) {
    return (
      <div className="update-prompt" role="status" aria-label="Backup problem">
        <p>{settings.lastAutoBackupError}</p>
        <Link className="button-link" to="/settings">
          Open backup settings
        </Link>
      </div>
    )
  }

  // Browsers without folder access cannot write on their own, so remind once a day instead.
  if (status === 'unsupported' && settings.autoBackupEnabled && dailyReminderDue) {
    return (
      <div className="update-prompt" role="status" aria-label="Daily backup reminder">
        <p>
          <strong>Save today&apos;s backup.</strong> It takes one tap and goes to your Downloads
          folder.
        </p>
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const file = await exportBackup(new Date(), __APP_VERSION__)
            downloadTextFile(backupFilename(), JSON.stringify(file, null, 2), 'application/json')
          }}
        >
          Save backup
        </button>
      </div>
    )
  }
  return null
}
