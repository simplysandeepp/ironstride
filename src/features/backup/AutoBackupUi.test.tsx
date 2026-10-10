import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import { createFakeFolder, type FakeFolder } from '../../test/fakeFolder.ts'
import { createBackup, emptyBackupData } from './backup.ts'
import { AutoBackupBanner } from './AutoBackupBanner.tsx'
import { AutoBackupSection } from './AutoBackupSection.tsx'
import { BACKUP_FILE, PREVIOUS_FILE } from './folderBackup.ts'
import { RestorePrompt } from './RestorePrompt.tsx'

const store = vi.hoisted(() => ({ handle: undefined as unknown }))
vi.mock('./autoBackupStore.ts', () => ({
  saveFolderHandle: async (h: unknown) => {
    store.handle = h
  },
  loadFolderHandle: async () => store.handle,
  clearFolderHandle: async () => {
    store.handle = undefined
  },
}))
const downloads = vi.hoisted(() => [] as string[])
vi.mock('./download.ts', () => ({
  downloadTextFile: (name: string) => downloads.push(name),
  backupFilename: () => 'ironstride-backup-test.json',
}))

const win = window as unknown as { showDirectoryPicker?: unknown }
const pickerReturns = (folder: FakeFolder) => {
  win.showDirectoryPicker = vi.fn().mockResolvedValue(folder)
}

beforeEach(() => {
  store.handle = undefined
  downloads.length = 0
})
afterEach(() => {
  delete win.showDirectoryPicker
})

const seedRun = (id = 'r1') =>
  repositories.runLogs.save({
    id,
    date: '2026-10-12',
    type: 'easy',
    actualDistanceKm: 4,
    completed: true,
  })

describe('AutoBackupSection with folder support', () => {
  it('explains how it works and its limits before anything is chosen', async () => {
    pickerReturns(createFakeFolder())
    render(<AutoBackupSection />)
    expect(await screen.findByText(/cannot run while the app is closed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose backup folder' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back up now/i })).toBeNull()
  })

  it('saves to the chosen folder immediately, remembers it, and shows the status', async () => {
    await seedRun()
    const folder = createFakeFolder('IronStride Backup')
    pickerReturns(folder)
    render(<AutoBackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Choose backup folder' }))
    expect(await screen.findByText(/backup saved\. folder: ironstride backup/i)).toBeInTheDocument()
    expect(folder.files.has(BACKUP_FILE)).toBe(true)
    expect(store.handle).toBe(folder)
    const settings = await repositories.settings.get()
    expect(settings).toMatchObject({
      autoBackupEnabled: true,
      autoBackupFolderName: 'IronStride Backup',
    })
    expect(await screen.findByRole('button', { name: 'Change backup folder' })).toBeInTheDocument()
  })

  it('says nothing was chosen when the picker is dismissed', async () => {
    win.showDirectoryPicker = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'))
    render(<AutoBackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Choose backup folder' }))
    expect(await screen.findByText(/no folder was chosen/i)).toBeInTheDocument()
    expect((await repositories.settings.get()).autoBackupEnabled).toBeFalsy()
  })

  it('will not overwrite a larger backup already in a folder chosen on a new install', async () => {
    const folder = createFakeFolder('IronStride Backup')
    const old = emptyBackupData()
    old.runLogs = [1, 2, 3].map((n) => ({
      id: `old${n}`,
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 5,
      completed: true,
    }))
    folder.files.set(BACKUP_FILE, JSON.stringify(createBackup(old, '2026-10-01T00:00:00.000Z')))
    const before = folder.files.get(BACKUP_FILE)
    await repositories.profile.save({ id: 'local-user' } as never)
    pickerReturns(folder)
    render(<AutoBackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Choose backup folder' }))
    expect(await screen.findByText(/already holds a larger backup/i)).toBeInTheDocument()
    expect(folder.files.get(BACKUP_FILE)).toBe(before)
  })

  it('backs up now on request and turns off cleanly, leaving folder files alone', async () => {
    await seedRun()
    const folder = createFakeFolder('IronStride Backup')
    store.handle = folder
    pickerReturns(folder)
    await repositories.settings.save({
      ...DEFAULT_SETTINGS,
      autoBackupEnabled: true,
      autoBackupFolderName: 'IronStride Backup',
    })
    render(<AutoBackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }))
    await waitFor(() => expect(folder.files.has(BACKUP_FILE)).toBe(true))
    await userEvent.click(screen.getByRole('button', { name: /turn off automatic backup/i }))
    await waitFor(() => expect(store.handle).toBeUndefined())
    expect((await repositories.settings.get()).autoBackupEnabled).toBe(false)
    expect(folder.files.has(BACKUP_FILE)).toBe(true)
    expect(
      await screen.findByText(/existing files in the folder are untouched/i),
    ).toBeInTheDocument()
  })
})

describe('AutoBackupSection without folder support', () => {
  it('is honest that it cannot run alone and offers a daily reminder instead', async () => {
    render(<AutoBackupSection />)
    expect(await screen.findByText(/cannot save to a folder by itself/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /choose backup folder/i })).toBeNull()
    await userEvent.click(
      screen.getByRole('checkbox', { name: /remind me to save a backup each day/i }),
    )
    await waitFor(async () =>
      expect((await repositories.settings.get()).autoBackupEnabled).toBe(true),
    )
  })

  it('describes storage protection', async () => {
    render(<AutoBackupSection />)
    expect(await screen.findByText(/storage protection is off/i)).toBeInTheDocument()
    expect(screen.getByText(/uninstalling the app can remove local data/i)).toBeInTheDocument()
  })
})

describe('AutoBackupBanner', () => {
  const renderBanner = () =>
    render(
      <MemoryRouter>
        <AutoBackupBanner active />
      </MemoryRouter>,
    )

  it('backs up automatically when the app opens, with no tap', async () => {
    await seedRun()
    const folder = createFakeFolder()
    store.handle = folder
    pickerReturns(folder)
    await repositories.settings.save({
      ...DEFAULT_SETTINGS,
      autoBackupEnabled: true,
      autoBackupFolderName: folder.name,
    })
    renderBanner()
    await waitFor(() => expect(folder.files.has(BACKUP_FILE)).toBe(true))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('updates the same file again on the next open when data changed', async () => {
    await seedRun('a')
    const folder = createFakeFolder()
    store.handle = folder
    pickerReturns(folder)
    await repositories.settings.save({
      ...DEFAULT_SETTINGS,
      autoBackupEnabled: true,
      autoBackupFolderName: folder.name,
    })
    const first = renderBanner()
    await waitFor(() => expect(folder.files.has(BACKUP_FILE)).toBe(true))
    first.unmount()
    await seedRun('b')
    await repositories.settings.save({
      ...(await repositories.settings.get()),
      lastAutoBackupAt: undefined,
    })
    renderBanner()
    await waitFor(() => expect(folder.files.has(PREVIOUS_FILE)).toBe(true))
    expect(JSON.parse(folder.files.get(BACKUP_FILE)!).data.runLogs).toHaveLength(2)
  })

  it('asks for one tap when the browser has revoked folder access, then saves', async () => {
    await seedRun()
    const folder = createFakeFolder('IronStride Backup', 'prompt')
    store.handle = folder
    pickerReturns(folder)
    await repositories.settings.save({
      ...DEFAULT_SETTINGS,
      autoBackupEnabled: true,
      autoBackupFolderName: folder.name,
    })
    renderBanner()
    const allow = await screen.findByRole('button', { name: 'Allow backups' })
    expect(folder.files.size).toBe(0)
    await userEvent.click(allow)
    await waitFor(() => expect(folder.files.has(BACKUP_FILE)).toBe(true))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Allow backups' })).toBeNull())
  })

  it('reminds daily with a one-tap save where folders are unsupported', async () => {
    await seedRun()
    await repositories.settings.save({ ...DEFAULT_SETTINGS, autoBackupEnabled: true })
    renderBanner()
    await userEvent.click(await screen.findByRole('button', { name: 'Save backup' }))
    await waitFor(() => expect(downloads).toEqual(['ironstride-backup-test.json']))
    await waitFor(async () => expect((await repositories.settings.get()).lastBackupAt).toBeTruthy())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save backup' })).toBeNull())
  })

  it('stays silent when off, or when there is nothing to protect', async () => {
    renderBanner()
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.queryByRole('status')).toBeNull()
    await repositories.settings.save({ ...DEFAULT_SETTINGS, autoBackupEnabled: true })
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.queryByRole('button', { name: 'Save backup' })).toBeNull()
  })
})

describe('RestorePrompt on a fresh install', () => {
  const backupWithRun = () => {
    const data = emptyBackupData()
    data.profile = [{ id: 'local-user', heightCm: 175 }]
    data.settings = [{ ...DEFAULT_SETTINGS, onboardingCompleted: true }]
    data.runLogs = [
      { id: 'r1', date: '2026-10-12', type: 'easy', actualDistanceKm: 4, completed: true },
    ]
    return JSON.stringify(createBackup(data, '2026-10-12T08:00:00.000Z'))
  }

  it('finds the backup in the folder you pick, previews it, restores it, and resumes auto backup', async () => {
    const folder = createFakeFolder('IronStride Backup')
    folder.files.set(BACKUP_FILE, backupWithRun())
    pickerReturns(folder)
    render(<RestorePrompt />)
    await userEvent.click(await screen.findByRole('button', { name: 'Restore from backup folder' }))
    const found = await screen.findByText(
      (_, el) =>
        el?.tagName === 'P' && /backup found from 2026-10-12: .*1 run,/i.test(el.textContent ?? ''),
    )
    expect(found).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore this backup' }))
    await waitFor(async () =>
      expect((await repositories.runLogs.all()).map((r) => r.id)).toEqual(['r1']),
    )
    const settings = await repositories.settings.get()
    expect(settings).toMatchObject({
      onboardingCompleted: true,
      autoBackupEnabled: true,
      autoBackupFolderName: 'IronStride Backup',
    })
    expect(store.handle).toBe(folder)
  })

  it('tells you plainly when the folder has no backup, and changes nothing', async () => {
    pickerReturns(createFakeFolder('Empty'))
    render(<RestorePrompt />)
    await userEvent.click(await screen.findByRole('button', { name: 'Restore from backup folder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no ironstride backup was found in "empty"/i,
    )
    expect(await repositories.runLogs.all()).toHaveLength(0)
  })

  it('can restore from a chosen file when there is no folder support', async () => {
    render(<RestorePrompt />)
    expect(screen.queryByRole('button', { name: /restore from backup folder/i })).toBeNull()
    await userEvent.upload(
      screen.getByLabelText(/restore from a backup file/i),
      new File([backupWithRun()], 'ironstride-backup.json', { type: 'application/json' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Restore this backup' }))
    await waitFor(async () =>
      expect((await repositories.settings.get()).onboardingCompleted).toBe(true),
    )
    expect(await repositories.runLogs.all()).toHaveLength(1)
    expect(store.handle).toBeUndefined()
  })

  it('rejects a damaged file, and Cancel leaves the device untouched', async () => {
    render(<RestorePrompt />)
    const input = screen.getByLabelText(/restore from a backup file/i)
    await userEvent.upload(input, new File(['{ nope'], 'x.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid json/i)
    await userEvent.upload(
      input,
      new File([backupWithRun()], 'ironstride-backup.json', { type: 'application/json' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Restore this backup' })).toBeNull()
    expect(await repositories.runLogs.all()).toHaveLength(0)
  })
})
