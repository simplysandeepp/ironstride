import { describe, expect, it } from 'vitest'
import { createFakeFolder, type FakeFolder } from '../../test/fakeFolder.ts'
import type { AppSettings } from '../../domain/types.ts'
import { emptyBackupData, type BackupData } from './backup.ts'
import {
  MIN_INTERVAL_MS,
  PROTECTED_MESSAGE,
  runAutoBackup,
  type AutoBackupDeps,
} from './autoBackup.ts'
import { BACKUP_FILE } from './folderBackup.ts'

const base: AppSettings = {
  id: 'app',
  theme: 'dark',
  distanceUnit: 'km',
  weightUnit: 'kg',
  onboardingCompleted: true,
  notificationsEnabled: false,
  autoBackupEnabled: true,
  autoBackupFolderName: 'IronStride Backup',
}
const run = (id: string) => ({
  id,
  date: '2026-10-12',
  type: 'easy',
  actualDistanceKm: 5,
  completed: true,
})
const withRuns = (...ids: string[]): BackupData => ({ ...emptyBackupData(), runLogs: ids.map(run) })
const NOW = new Date('2026-10-12T08:00:00.000Z')

function setup(
  over: {
    settings?: Partial<AppSettings>
    folder?: FakeFolder | null
    data?: BackupData
    supported?: boolean
    now?: Date
  } = {},
) {
  const state = { settings: { ...base, ...over.settings } as AppSettings }
  const folder = over.folder === null ? undefined : (over.folder ?? createFakeFolder())
  const deps: AutoBackupDeps = {
    supported: () => over.supported ?? true,
    loadHandle: async () => folder,
    readAll: async () => over.data ?? withRuns('a'),
    getSettings: async () => state.settings,
    saveSettings: async (patch) => {
      state.settings = { ...state.settings, ...patch }
    },
    now: () => over.now ?? NOW,
    appVersion: '0.1.0',
  }
  return { deps, state, folder }
}

describe('runAutoBackup', () => {
  it('does nothing when switched off, unsupported, or no folder was chosen', async () => {
    expect(await runAutoBackup(setup({ settings: { autoBackupEnabled: false } }).deps)).toBe('off')
    expect(await runAutoBackup(setup({ supported: false }).deps)).toBe('unsupported')
    expect(await runAutoBackup(setup({ folder: null }).deps)).toBe('no-folder')
  })

  it('backs up on open, writes the same file, and records the time', async () => {
    const { deps, state, folder } = setup()
    expect(await runAutoBackup(deps)).toBe('done')
    expect(folder!.files.has(BACKUP_FILE)).toBe(true)
    expect(state.settings.lastAutoBackupAt).toBe(NOW.toISOString())
    expect(state.settings.lastAutoBackupError).toBeUndefined()
  })

  it('does not rewrite files again within a couple of minutes, unless forced', async () => {
    const recent = new Date(NOW.getTime() - (MIN_INTERVAL_MS - 1000)).toISOString()
    const { deps, folder } = setup({ settings: { lastAutoBackupAt: recent } })
    expect(await runAutoBackup(deps)).toBe('skipped-recent')
    expect(folder!.writes).toEqual([])
    expect(await runAutoBackup(deps, { force: true })).toBe('done')
    const stale = new Date(NOW.getTime() - MIN_INTERVAL_MS - 1000).toISOString()
    expect(await runAutoBackup(setup({ settings: { lastAutoBackupAt: stale } }).deps)).toBe('done')
  })

  it('backs up on every open even if one ran moments ago, but not when only leaving the app', async () => {
    const justNow = new Date(NOW.getTime() - 5_000).toISOString()
    const { deps, folder } = setup({ settings: { lastAutoBackupAt: justNow } })
    expect(await runAutoBackup(deps)).toBe('skipped-recent')
    expect(await runAutoBackup(deps, { ignoreRecent: true })).toBe('done')
    expect(folder!.files.size).toBeGreaterThan(0)
  })

  it('reports when the browser needs a tap to allow the folder again, and writes nothing', async () => {
    const { deps, folder } = setup({ folder: createFakeFolder('x', 'prompt') })
    expect(await runAutoBackup(deps)).toBe('needs-permission')
    expect(folder!.writes).toEqual([])
  })

  it('asks for permission only when told it came from a tap', async () => {
    const { deps, folder } = setup({ folder: createFakeFolder('x', 'prompt') })
    expect(await runAutoBackup(deps, { requestPermission: true })).toBe('done')
    expect(folder!.writes.length).toBeGreaterThan(0)
    const denied = createFakeFolder('x', 'prompt')
    denied.grantOnRequest = false
    expect(await runAutoBackup(setup({ folder: denied }).deps, { requestPermission: true })).toBe(
      'needs-permission',
    )
  })

  it('never backs up an empty database', async () => {
    const { deps, folder } = setup({ data: emptyBackupData() })
    expect(await runAutoBackup(deps)).toBe('skipped-empty')
    expect(folder!.writes).toEqual([])
  })

  it('reports unchanged data without rewriting', async () => {
    const { deps, folder } = setup()
    await runAutoBackup(deps, { force: true })
    folder!.writes.length = 0
    expect(await runAutoBackup(deps, { force: true })).toBe('unchanged')
    expect(folder!.writes).toEqual([])
  })

  it('protects a fuller backup from a fresh-looking database and says why', async () => {
    const folder = createFakeFolder()
    await runAutoBackup(setup({ folder, data: withRuns('a', 'b', 'c') }).deps, { force: true })
    const before = folder.files.get(BACKUP_FILE)
    const fresh = setup({ folder, data: { ...emptyBackupData(), profile: [{ id: 'local-user' }] } })
    expect(await runAutoBackup(fresh.deps)).toBe('protected')
    expect(folder.files.get(BACKUP_FILE)).toBe(before)
    expect(fresh.state.settings.lastAutoBackupError).toBe(PROTECTED_MESSAGE)
  })

  it('catches write failures, records a message, and never throws', async () => {
    const folder = createFakeFolder()
    folder.failWrites = true
    const { deps, state } = setup({ folder })
    expect(await runAutoBackup(deps)).toBe('error')
    expect(state.settings.lastAutoBackupError).toMatch(/could not be saved \(disk full\)/)
    expect(state.settings.lastAutoBackupAt).toBeUndefined()
  })
})
