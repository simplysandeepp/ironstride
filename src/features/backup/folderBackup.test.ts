import { afterEach, describe, expect, it } from 'vitest'
import { createFakeFolder } from '../../test/fakeFolder.ts'
import { createBackup, emptyBackupData, validateBackupFile, type BackupData } from './backup.ts'
import {
  BACKUP_FILE,
  countLogs,
  ensureFolderPermission,
  GYM_CSV,
  hasMeaningfulData,
  PREVIOUS_FILE,
  pickBackupFolder,
  README_FILE,
  readBackupFolder,
  RUNS_CSV,
  supportsFolderBackup,
  WEIGHT_CSV,
  writeBackupFolder,
} from './folderBackup.ts'

const run = (id: string, km = 5) => ({
  id,
  date: '2026-10-12',
  type: 'easy',
  actualDistanceKm: km,
  completed: true,
})
const withRuns = (...ids: string[]): BackupData => ({
  ...emptyBackupData(),
  runLogs: ids.map((id) => run(id)),
})
const T1 = '2026-10-12T08:00:00.000Z'
const T2 = '2026-10-13T08:00:00.000Z'
const normal = { overwriteSmaller: false }

describe('writeBackupFolder', () => {
  it('writes the JSON, the CSV copies and a README, and the JSON is a valid backup', async () => {
    const dir = createFakeFolder()
    expect(await writeBackupFolder(dir, withRuns('a'), T1, '0.1.0', normal)).toBe('done')
    expect([...dir.files.keys()].sort()).toEqual(
      [BACKUP_FILE, GYM_CSV, README_FILE, RUNS_CSV, WEIGHT_CSV].sort(),
    )
    const parsed = validateBackupFile(JSON.parse(dir.files.get(BACKUP_FILE)!))
    expect(parsed.ok && parsed.data.runLogs).toHaveLength(1)
    expect(dir.files.get(RUNS_CSV)).toContain('2026-10-12')
    expect(dir.files.has(PREVIOUS_FILE)).toBe(false)
  })

  it('updates the same file next time and keeps the earlier version as the previous copy', async () => {
    const dir = createFakeFolder()
    await writeBackupFolder(dir, withRuns('a'), T1, undefined, normal)
    const first = dir.files.get(BACKUP_FILE)!
    expect(await writeBackupFolder(dir, withRuns('a', 'b'), T2, undefined, normal)).toBe('done')
    expect([...dir.files.keys()].filter((k) => k.endsWith('.json')).sort()).toEqual([
      BACKUP_FILE,
      PREVIOUS_FILE,
    ])
    expect(dir.files.get(PREVIOUS_FILE)).toBe(first)
    const latest = validateBackupFile(JSON.parse(dir.files.get(BACKUP_FILE)!))
    expect(latest.ok && latest.data.runLogs.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('does not rewrite anything when nothing has changed', async () => {
    const dir = createFakeFolder()
    await writeBackupFolder(dir, withRuns('a'), T1, undefined, normal)
    dir.writes.length = 0
    expect(await writeBackupFolder(dir, withRuns('a'), T2, undefined, normal)).toBe('unchanged')
    expect(dir.writes).toEqual([])
  })

  it('ignores bookkeeping timestamps when judging whether data changed', async () => {
    const dir = createFakeFolder()
    const base = withRuns('a')
    base.settings = [{ id: 'app', theme: 'dark', lastAutoBackupAt: T1 }]
    await writeBackupFolder(dir, base, T1, undefined, normal)
    const later = {
      ...base,
      settings: [{ id: 'app', theme: 'dark', lastAutoBackupAt: T2, lastBackupAt: T2 }],
    }
    expect(await writeBackupFolder(dir, later, T2, undefined, normal)).toBe('unchanged')
    const themed = { ...base, settings: [{ id: 'app', theme: 'light', lastAutoBackupAt: T2 }] }
    expect(await writeBackupFolder(dir, themed, T2, undefined, normal)).toBe('done')
  })

  it('never replaces a populated backup with one that has no logs (a fresh reinstall)', async () => {
    const dir = createFakeFolder()
    await writeBackupFolder(dir, withRuns('a', 'b', 'c'), T1, undefined, normal)
    const before = dir.files.get(BACKUP_FILE)
    const freshInstall: BackupData = { ...emptyBackupData(), profile: [{ id: 'local-user' }] }
    expect(await writeBackupFolder(dir, freshInstall, T2, undefined, normal)).toBe('protected')
    expect(dir.files.get(BACKUP_FILE)).toBe(before)
  })

  it('lets an explicit "back up now" replace it, after keeping the old one', async () => {
    const dir = createFakeFolder()
    await writeBackupFolder(dir, withRuns('a', 'b'), T1, undefined, normal)
    const old = dir.files.get(BACKUP_FILE)
    const emptyish: BackupData = { ...emptyBackupData(), profile: [{ id: 'local-user' }] }
    expect(await writeBackupFolder(dir, emptyish, T2, undefined, { overwriteSmaller: true })).toBe(
      'done',
    )
    expect(dir.files.get(PREVIOUS_FILE)).toBe(old)
  })

  it('leaves the existing backup untouched if writing fails', async () => {
    const dir = createFakeFolder()
    await writeBackupFolder(dir, withRuns('a'), T1, undefined, normal)
    const before = dir.files.get(BACKUP_FILE)
    dir.failWrites = true
    await expect(writeBackupFolder(dir, withRuns('a', 'b'), T2, undefined, normal)).rejects.toThrow(
      'disk full',
    )
    expect(dir.files.get(BACKUP_FILE)).toBe(before)
  })

  it('treats an unreadable existing file as no backup instead of failing', async () => {
    const dir = createFakeFolder()
    dir.files.set(BACKUP_FILE, '{ broken')
    expect(await writeBackupFolder(dir, withRuns('a'), T1, undefined, normal)).toBe('done')
    expect(dir.files.has(PREVIOUS_FILE)).toBe(false)
  })
})

describe('readBackupFolder', () => {
  const file = (data: BackupData) => JSON.stringify(createBackup(data, T1))

  it('finds and validates the backup', async () => {
    const dir = createFakeFolder()
    dir.files.set(BACKUP_FILE, file(withRuns('a', 'b')))
    const result = await readBackupFolder(dir)
    expect(result.ok && result.data.runLogs).toHaveLength(2)
  })

  it('explains clearly when the folder has no backup', async () => {
    const result = await readBackupFolder(createFakeFolder('Documents'))
    expect(!result.ok && result.errors[0]).toMatch(/No IronStride backup was found in "Documents"/)
  })

  it('falls back to the previous copy when the latest is damaged, and says so', async () => {
    const dir = createFakeFolder()
    dir.files.set(BACKUP_FILE, '{ truncated')
    dir.files.set(PREVIOUS_FILE, file(withRuns('a')))
    const result = await readBackupFolder(dir)
    expect(result.ok && result.data.runLogs).toHaveLength(1)
    expect(result.ok && result.warnings[0]).toMatch(/previous copy was used/)
  })

  it('reports problems when nothing usable exists', async () => {
    const dir = createFakeFolder()
    dir.files.set(BACKUP_FILE, '{ truncated')
    expect((await readBackupFolder(dir)).ok).toBe(false)
  })
})

describe('permission and detection', () => {
  const win = window as unknown as { showDirectoryPicker?: unknown }
  afterEach(() => {
    delete win.showDirectoryPicker
  })

  it('reports granted, asks only when allowed to, and survives errors', async () => {
    const dir = createFakeFolder('x', 'prompt')
    expect(await ensureFolderPermission(dir, false)).toBe('prompt')
    expect(await ensureFolderPermission(dir, true)).toBe('granted')
    const denied = createFakeFolder('x', 'prompt')
    denied.grantOnRequest = false
    expect(await ensureFolderPermission(denied, true)).toBe('denied')
    const broken = {
      ...createFakeFolder(),
      queryPermission: async () => Promise.reject(new Error('gone')),
    }
    expect(await ensureFolderPermission(broken, true)).toBe('denied')
  })

  it('detects folder support at runtime', async () => {
    expect(supportsFolderBackup()).toBe(false)
    expect(() => pickBackupFolder()).toThrow(/not supported/i)
    const dir = createFakeFolder()
    win.showDirectoryPicker = async () => dir
    expect(supportsFolderBackup()).toBe(true)
    expect(await pickBackupFolder()).toBe(dir)
  })

  it('counts logs and meaningful data', () => {
    expect(countLogs(emptyBackupData())).toBe(0)
    expect(hasMeaningfulData(emptyBackupData())).toBe(false)
    expect(hasMeaningfulData({ ...emptyBackupData(), profile: [{ id: 'local-user' }] })).toBe(true)
    expect(countLogs(withRuns('a', 'b'))).toBe(2)
  })
})
