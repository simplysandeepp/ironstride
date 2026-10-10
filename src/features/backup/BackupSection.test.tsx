import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { repositories } from '../../db/repositories.ts'
import { createBackup, emptyBackupData } from './backup.ts'
import { BackupSection } from './BackupSection.tsx'

const downloads: { name: string; text: string }[] = []
vi.mock('./download.ts', () => ({
  downloadTextFile: (name: string, text: string) => downloads.push({ name, text }),
  backupFilename: () => 'ironstride-backup-test.json',
}))

beforeEach(() => {
  downloads.length = 0
})

const upload = (content: string) =>
  userEvent.upload(
    screen.getByLabelText(/restore from a backup file/i),
    new File([content], 'backup.json', { type: 'application/json' }),
  )

const backupWith = (runs: object[]) => {
  const data = emptyBackupData()
  data.runLogs = runs as never
  return JSON.stringify(createBackup(data, '2026-10-12T08:00:00Z'))
}

describe('BackupSection', () => {
  it('exports a JSON backup and a CSV, and notes that backups are sensitive', async () => {
    await repositories.runLogs.save({
      id: 'r1',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: /export backup \(json\)/i }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toBe('ironstride-backup-test.json')
    expect(JSON.parse(downloads[0].text).data.runLogs).toHaveLength(1)
    expect(await screen.findByText(/personal health data/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /export runs \(csv\)/i }))
    await waitFor(() => expect(downloads).toHaveLength(2))
    expect(downloads[1].name).toBe('ironstride-runs.csv')
    expect(downloads[1].text).toContain('2026-10-12')
  })

  it('reminds you to back up when you have data and no backup', async () => {
    await repositories.runLogs.save({
      id: 'r1',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    expect(await screen.findByText(/have not made a backup yet/i)).toBeInTheDocument()
  })

  it('rejects a broken file with reasons and changes nothing', async () => {
    await repositories.runLogs.save({
      id: 'keep',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await upload('{ not json')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid json/i)
    await upload(
      backupWith([
        { id: 'bad', date: '2026-10-12', type: 'easy', actualDistanceKm: -2, completed: true },
      ]),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid distance/i)
    expect((await repositories.runLogs.all()).map((r) => r.id)).toEqual(['keep'])
  })

  it('previews a valid backup, then merges without losing current records', async () => {
    await repositories.runLogs.save({
      id: 'keep',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await upload(
      backupWith([
        { id: 'new', date: '2026-10-14', type: 'tempo', actualDistanceKm: 5, completed: true },
      ]),
    )
    expect(
      await screen.findByText(/1 new records, 0 already on this device, 0 that differ/i),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /merge \(keep my current versions\)/i }),
    )
    expect(await screen.findByText(/import finished: 1 added/i)).toBeInTheDocument()
    expect((await repositories.runLogs.all()).map((r) => r.id).sort()).toEqual(['keep', 'new'])
  })

  it('asks before replacing everything, and Cancel keeps current data', async () => {
    await repositories.runLogs.save({
      id: 'keep',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await upload(
      backupWith([
        { id: 'new', date: '2026-10-14', type: 'tempo', actualDistanceKm: 5, completed: true },
      ]),
    )
    await userEvent.click(await screen.findByRole('button', { name: /replace everything/i }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      /export a backup of your current data first/i,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect((await repositories.runLogs.all()).map((r) => r.id)).toEqual(['keep'])

    await userEvent.click(screen.getByRole('button', { name: /replace everything/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await waitFor(async () =>
      expect((await repositories.runLogs.all()).map((r) => r.id)).toEqual(['new']),
    )
  })

  it('offers backup-version choice only when records differ', async () => {
    await repositories.runLogs.save({
      id: 'a',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await upload(
      backupWith([
        { id: 'a', date: '2026-10-12', type: 'easy', actualDistanceKm: 6, completed: true },
      ]),
    )
    await userEvent.click(await screen.findByRole('button', { name: /use the backup's versions/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Overwrite' }))
    await waitFor(async () =>
      expect((await repositories.runLogs.get('a'))?.actualDistanceKm).toBe(6),
    )
  })

  it('reset needs the word DELETE and wipes everything', async () => {
    await repositories.runLogs.save({
      id: 'a',
      date: '2026-10-12',
      type: 'easy',
      actualDistanceKm: 4,
      completed: true,
    })
    render(<BackupSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reset all local data' }))
    const confirmButton = screen.getByRole('button', { name: 'Delete everything' })
    expect(confirmButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type DELETE'), 'delete')
    expect(confirmButton).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Type DELETE'))
    await userEvent.type(screen.getByLabelText('Type DELETE'), 'DELETE')
    await userEvent.click(confirmButton)
    await waitFor(async () => expect(await repositories.runLogs.all()).toHaveLength(0))
  })
})
