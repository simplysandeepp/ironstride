import { useState } from 'react'
import { updateSettings } from '../nutrition/habits.ts'
import { emptyBackupData, resolveImport, validateBackupFile, type BackupData } from './backup.ts'
import { saveFolderHandle } from './autoBackupStore.ts'
import { writeAllData } from './backupDb.ts'
import { describeBackup } from './backupSummary.ts'
import {
  pickBackupFolder,
  readBackupFolder,
  supportsFolderBackup,
  type DirHandleLike,
} from './folderBackup.ts'

type Preview = { data: BackupData; exportedAt: string; warnings: string[]; dir?: DirHandleLike }

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** First-run offer to bring everything back after a reinstall or on a new phone. */
export function RestorePrompt() {
  const [preview, setPreview] = useState<Preview>()
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function fromFolder() {
    setErrors([])
    setPreview(undefined)
    let dir: DirHandleLike
    try {
      dir = await pickBackupFolder()
    } catch (e) {
      if (!isAbort(e)) setErrors(['Could not open that folder.'])
      return
    }
    const result = await readBackupFolder(dir)
    if (!result.ok) return setErrors(result.errors)
    setPreview({ data: result.data, exportedAt: result.exportedAt, warnings: result.warnings, dir })
  }

  async function fromFile(file: File | undefined) {
    setErrors([])
    setPreview(undefined)
    if (!file) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return setErrors(['That file is not valid JSON, so it cannot be a backup.'])
    }
    const result = validateBackupFile(parsed)
    if (!result.ok) return setErrors(result.errors)
    setPreview({ data: result.data, exportedAt: result.exportedAt, warnings: result.warnings })
  }

  async function restore() {
    if (!preview || busy) return
    setBusy(true)
    try {
      await writeAllData(resolveImport(emptyBackupData(), preview.data, 'replace'))
      if (preview.dir) await saveFolderHandle(preview.dir)
      // Opens the app. If a folder was used, automatic backup carries on into it.
      await updateSettings({
        onboardingCompleted: true,
        ...(preview.dir ? { autoBackupEnabled: true, autoBackupFolderName: preview.dir.name } : {}),
      })
    } catch {
      setErrors(['The restore could not be completed. Nothing was changed.'])
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="restore-heading">
      <h2 id="restore-heading">Reinstalling or new phone?</h2>
      <p className="helper">
        Bring your history back from a backup. Your browser only lets IronStride read a backup you
        point it to, so choose the folder (or file) you saved before.
      </p>
      <div className="form-actions">
        {supportsFolderBackup() && (
          <button type="button" className="primary" onClick={() => void fromFolder()}>
            Restore from backup folder
          </button>
        )}
      </div>
      <div className="field">
        <label htmlFor="restore-file">Restore from a backup file</label>
        <input
          id="restore-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => void fromFile(e.target.files?.[0])}
        />
      </div>

      {errors.length > 0 && (
        <div role="alert" className="field-error">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="stack" aria-live="polite">
          <p>
            <strong>Backup found</strong>
            {preview.exportedAt ? ` from ${preview.exportedAt.slice(0, 10)}` : ''}:{' '}
            {describeBackup(preview.data)}.
          </p>
          {preview.warnings.map((w) => (
            <p className="helper" key={w}>
              {w}
            </p>
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void restore()}
            >
              Restore this backup
            </button>
            <button type="button" onClick={() => setPreview(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
