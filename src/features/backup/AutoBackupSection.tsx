import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { repositories } from '../../db/repositories.ts'
import { formatDateTime } from '../../domain/timezone.ts'
import { isStoragePersistent, requestPersistentStorage } from '../../pwa/storage.ts'
import { updateSettings } from '../nutrition/habits.ts'
import { runAutoBackup, type AutoBackupStatus } from './autoBackup.ts'
import { clearFolderHandle, saveFolderHandle } from './autoBackupStore.ts'
import { realAutoBackupDeps } from './autoBackupRuntime.ts'
import { pickBackupFolder, supportsFolderBackup } from './folderBackup.ts'

const MESSAGES: Record<AutoBackupStatus, string> = {
  off: 'Automatic backup is off.',
  unsupported: 'This browser cannot save to a folder.',
  'no-folder': 'Choose a folder first.',
  'needs-permission': 'Allow access to the folder when your browser asks.',
  'skipped-empty': 'There is nothing to back up yet. It will start once you have logged something.',
  'skipped-recent': 'Backed up a moment ago.',
  unchanged: 'Your backup is already up to date.',
  done: 'Backup saved.',
  protected:
    'That folder already holds a larger backup, so it was not overwritten. Restore it, or choose another folder.',
  error: 'The backup could not be saved.',
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export function AutoBackupSection() {
  const settings = useLiveQuery(() => repositories.settings.get())
  const [message, setMessage] = useState<string>()
  const [persistent, setPersistent] = useState<boolean>()
  const supported = supportsFolderBackup()

  useEffect(() => {
    void isStoragePersistent().then(setPersistent)
  }, [])

  if (!settings) return null
  const enabled = Boolean(settings.autoBackupEnabled)
  const hasFolder = Boolean(settings.autoBackupFolderName)

  async function chooseFolder() {
    setMessage(undefined)
    try {
      const dir = await pickBackupFolder()
      await saveFolderHandle(dir)
      await updateSettings({
        autoBackupEnabled: true,
        autoBackupFolderName: dir.name,
        lastAutoBackupAt: undefined,
        lastAutoBackupError: undefined,
      })
      const result = await runAutoBackup(realAutoBackupDeps(), { force: false })
      setMessage(`${MESSAGES[result]} Folder: ${dir.name}.`)
    } catch (e) {
      setMessage(
        isAbort(e)
          ? 'No folder was chosen.'
          : 'Could not use that folder. Try creating a new one, such as "IronStride Backup".',
      )
    }
  }

  async function backUpNow() {
    const result = await runAutoBackup(realAutoBackupDeps(), {
      force: true,
      requestPermission: true,
    })
    setMessage(
      result === 'error' ? (settings?.lastAutoBackupError ?? MESSAGES.error) : MESSAGES[result],
    )
  }

  async function turnOff() {
    await clearFolderHandle().catch(() => undefined)
    await updateSettings({
      autoBackupEnabled: false,
      autoBackupFolderName: undefined,
      lastAutoBackupError: undefined,
    })
    setMessage('Automatic backup is off. Existing files in the folder are untouched.')
  }

  return (
    <section className="card" aria-labelledby="auto-backup-heading">
      <h2 id="auto-backup-heading">Automatic backup</h2>
      {supported ? (
        <>
          <p className="helper">
            Choose a folder once (for example a new one called &quot;IronStride Backup&quot;). Each
            time you open IronStride, and when you leave it, the same file is updated there with
            your latest data, plus CSV copies for spreadsheets. It cannot run while the app is
            closed, and it never replaces a fuller backup with an empty one.
          </p>
          {enabled && hasFolder && (
            <p role="status">
              Saving to <strong>{settings.autoBackupFolderName}</strong>.{' '}
              {settings.lastAutoBackupAt
                ? `Last backup: ${formatDateTime(settings.lastAutoBackupAt)}.`
                : 'No backup yet.'}
            </p>
          )}
          {settings.lastAutoBackupError && (
            <p className="field-error" role="alert">
              {settings.lastAutoBackupError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="primary" onClick={() => void chooseFolder()}>
              {hasFolder ? 'Change backup folder' : 'Choose backup folder'}
            </button>
            {enabled && hasFolder && (
              <>
                <button type="button" onClick={() => void backUpNow()}>
                  Back up now
                </button>
                <button type="button" onClick={() => void turnOff()}>
                  Turn off automatic backup
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="helper">
            This browser cannot save to a folder by itself, and a web app cannot run in the
            background to do it for you. IronStride can remind you once a day, when you open it, to
            save a backup file with one tap.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const on = e.target.checked
                void updateSettings({ autoBackupEnabled: on })
              }}
            />
            Remind me to save a backup each day
          </label>
        </>
      )}
      {message && (
        <p role="status" className="helper">
          {message}
        </p>
      )}

      <h3>Keeping your data safe</h3>
      <p className="helper">
        {persistent
          ? 'Storage protection is on: the browser will not clear IronStride data to free space.'
          : 'Storage protection is off, so the browser may clear data if the phone runs low on space.'}{' '}
        Uninstalling the app can remove local data, which is why a backup in a folder matters.
      </p>
      {!persistent && (
        <button type="button" onClick={() => void requestPersistentStorage().then(setPersistent)}>
          Ask the browser to protect storage
        </button>
      )}
    </section>
  )
}
