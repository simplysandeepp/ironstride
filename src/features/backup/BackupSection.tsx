import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { repositories } from '../../db/repositories.ts'
import {
  countPlan,
  gymToCsv,
  planMerge,
  resolveImport,
  runsToCsv,
  weightToCsv,
  type BackupData,
  type ImportMode,
  validateBackupFile,
} from './backup.ts'
import { exportBackup, isBackupDue, readAllData, resetAllData, writeAllData } from './backupDb.ts'
import { backupFilename, downloadTextFile } from './download.ts'

type Pending = { data: BackupData; counts: ReturnType<typeof countPlan>; warnings: string[] }
type Confirm = { mode: ImportMode } | 'reset' | null

export function BackupSection() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>()
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string>()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [resetText, setResetText] = useState('')

  const status = useLiveQuery(async () => {
    const data = await readAllData()
    const settings = await repositories.settings.get()
    const hasData =
      data.gymSessions.length +
        data.runLogs.length +
        data.foodEntries.length +
        data.bodyMeasurements.length >
      0
    return { lastBackupAt: settings.lastBackupAt, due: isBackupDue(settings.lastBackupAt, hasData) }
  })

  async function exportJson() {
    const file = await exportBackup(new Date(), __APP_VERSION__)
    downloadTextFile(backupFilename(), JSON.stringify(file, null, 2), 'application/json')
    setMessage(
      'Backup saved to your downloads. Keep it somewhere private: it contains personal health data.',
    )
  }

  async function exportCsv(name: 'runs' | 'gym' | 'weight') {
    const data = await readAllData()
    const build = {
      runs: () => runsToCsv(data.runLogs),
      gym: () => gymToCsv(data.gymSessions),
      weight: () => weightToCsv(data.bodyMeasurements),
    }
    downloadTextFile(`ironstride-${name}.csv`, build[name](), 'text/csv')
  }

  async function chooseFile(file: File | undefined) {
    setPending(undefined)
    setErrors([])
    setMessage(undefined)
    if (!file) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return setErrors(['That file is not valid JSON, so it cannot be a backup.'])
    }
    const result = validateBackupFile(parsed)
    if (!result.ok) return setErrors(result.errors)
    const plan = planMerge(await readAllData(), result.data)
    setPending({ data: result.data, counts: countPlan(plan), warnings: result.warnings })
  }

  async function applyImport(mode: ImportMode) {
    if (!pending) return
    try {
      const next = resolveImport(await readAllData(), pending.data, mode)
      await writeAllData(next)
      setMessage(
        mode === 'replace'
          ? 'Backup restored. Your data now matches the backup.'
          : `Import finished: ${pending.counts.add} added, ${pending.counts.same} already present${mode === 'merge-overwrite' ? `, ${pending.counts.conflicts} updated from the backup` : `, ${pending.counts.conflicts} differing records kept as they were`}.`,
      )
      setPending(undefined)
    } catch {
      setErrors(['The import could not be completed, and your existing data was not changed.'])
    }
    setConfirm(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function reset() {
    await resetAllData()
    setConfirm(null)
    setResetText('')
    setMessage('All local data was deleted.')
  }

  return (
    <section className="card" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Backup and restore</h2>
      <p className="helper">
        Your data is stored only in this browser. Clearing site data, or losing the phone, deletes
        it. Backup files are not encrypted, so keep them private.
      </p>
      {status?.due && (
        <p className="hint" role="status">
          {status.lastBackupAt
            ? 'Your last backup is more than 2 weeks old.'
            : 'You have not made a backup yet.'}{' '}
          Export one now.
        </p>
      )}
      {status?.lastBackupAt && (
        <p className="helper">Last backup: {status.lastBackupAt.slice(0, 10)}</p>
      )}

      <div className="form-actions">
        <button type="button" className="primary" onClick={() => void exportJson()}>
          Export backup (JSON)
        </button>
        <button type="button" onClick={() => void exportCsv('runs')}>
          Export runs (CSV)
        </button>
        <button type="button" onClick={() => void exportCsv('gym')}>
          Export gym sets (CSV)
        </button>
        <button type="button" onClick={() => void exportCsv('weight')}>
          Export body weight (CSV)
        </button>
      </div>

      <div className="field">
        <label htmlFor="backup-file">Restore from a backup file</label>
        <input
          id="backup-file"
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
      </div>

      {errors.length > 0 && (
        <div role="alert" className="field-error">
          <p>
            <strong>This file cannot be imported.</strong> Nothing was changed.
          </p>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {pending && (
        <div className="stack" aria-live="polite">
          <p>
            <strong>Backup preview:</strong> {pending.counts.add} new records, {pending.counts.same}{' '}
            already on this device, {pending.counts.conflicts} that differ from what you have.
          </p>
          {pending.warnings.map((w) => (
            <p className="helper" key={w}>
              {w}
            </p>
          ))}
          <div className="form-actions">
            <button type="button" className="primary" onClick={() => void applyImport('merge')}>
              Merge (keep my current versions)
            </button>
            {pending.counts.conflicts > 0 && (
              <button type="button" onClick={() => setConfirm({ mode: 'merge-overwrite' })}>
                Merge and use the backup&apos;s versions
              </button>
            )}
            <button type="button" onClick={() => setConfirm({ mode: 'replace' })}>
              Replace everything with this backup
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="helper">
          {message}
        </p>
      )}

      <h3>Reset</h3>
      <p className="helper">Deletes every log and setting on this device. Export a backup first.</p>
      <button type="button" onClick={() => setConfirm('reset')}>
        Reset all local data
      </button>

      {confirm && confirm !== 'reset' && (
        <ConfirmDialog
          title={confirm.mode === 'replace' ? 'Replace all data?' : 'Overwrite differing records?'}
          message={
            confirm.mode === 'replace'
              ? 'Everything on this device will be replaced by the backup. Export a backup of your current data first if you might need it.'
              : 'Records that differ will take the values from the backup file.'
          }
          confirmLabel={confirm.mode === 'replace' ? 'Replace' : 'Overwrite'}
          onConfirm={() => void applyImport(confirm.mode)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === 'reset' && (
        <div className="dialog-backdrop">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="dialog card"
          >
            <h2 id="reset-title">Delete all local data?</h2>
            <p>This cannot be undone. Type DELETE to confirm.</p>
            <div className="field">
              <label htmlFor="reset-confirm">Type DELETE</label>
              <input
                id="reset-confirm"
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null)
                  setResetText('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={resetText !== 'DELETE'}
                onClick={() => void reset()}
              >
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
