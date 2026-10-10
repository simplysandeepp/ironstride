import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/database.ts'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import { emptyBackupData, resolveImport, validateBackupFile, type BackupData } from './backup.ts'
import { exportBackup, isBackupDue, readAllData, resetAllData, writeAllData } from './backupDb.ts'

async function seed() {
  await repositories.profile.save({
    id: 'local-user',
    heightCm: 175,
    currentWeightKg: 66,
    targetWeightMinKg: 72,
    targetWeightMaxKg: 75,
    ageRange: '20-25',
    dietaryPattern: 'vegan',
    weeklyRunBaselineKm: 18,
    recentLongRunKm: 10,
    gymDaysPerWeek: 3,
    runDaysPerWeek: 4,
    gymSessionMinutes: 60,
    trainingStartDate: '2026-10-12',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  })
  await repositories.settings.save({
    ...DEFAULT_SETTINGS,
    onboardingCompleted: true,
    waterTargetMl: 3200,
  })
  await repositories.nutritionTargets.save({
    caloriesKcal: 2700,
    proteinG: 130,
    carbsG: 388,
    fatG: 69,
    effectiveFrom: '2026-10-01',
  })
  await repositories.gymSessions.save({
    id: 'g1',
    date: '2026-10-12',
    title: 'Upper A',
    status: 'completed',
    plannedWorkoutId: 'w1-d1-gym',
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseNameSnapshot: 'Bench',
        sets: [{ id: 's1', setNumber: 1, loadKg: 40, reps: 8, completed: true }],
      },
    ],
  })
  await repositories.runLogs.save({
    id: 'r1',
    date: '2026-10-12',
    type: 'easy',
    actualDistanceKm: 4,
    durationSeconds: 1440,
    completed: true,
    notes: 'ok, "easy"',
  })
  await repositories.foodEntries.save({
    id: 'f1',
    date: '2026-10-12',
    meal: 'breakfast',
    name: 'Oats',
    quantity: 40,
    unit: 'g',
    caloriesKcal: 150,
    proteinG: 5,
    carbsG: 27,
    fatG: 3,
  })
  await repositories.bodyMeasurements.save({ id: 'b1', date: '2026-10-12', weightKg: 66.4 })
  await repositories.supplementLogs.save({
    id: 'sup1',
    date: '2026-10-12',
    supplement: 'creatine',
    amount: 3,
    unit: 'g',
    status: 'taken',
  })
  await repositories.waterEntries.save({ id: 'w1', date: '2026-10-12', amountMl: 250 })
}

beforeEach(resetAllData)

describe('backup round trip', () => {
  it('export, wipe and restore gives back identical data', async () => {
    await seed()
    const before = await readAllData()
    const file = await exportBackup(new Date('2026-10-12T08:00:00Z'), '0.1.0')
    expect(file.schemaVersion).toBe(1)
    expect(file.exportedAt).toBe('2026-10-12T08:00:00.000Z')

    // Through real JSON, as a file would be.
    const parsed = validateBackupFile(JSON.parse(JSON.stringify(file)))
    expect(parsed.ok).toBe(true)
    await resetAllData()
    expect((await readAllData()).runLogs).toHaveLength(0)
    await writeAllData(
      resolveImport(await readAllData(), (parsed as { data: BackupData }).data, 'replace'),
    )
    const after = await readAllData()
    // Exporting stamps lastBackupAt on the settings, which is expected to differ.
    expect({ ...after, settings: [] }).toEqual({ ...before, settings: [] })
    expect(after.settings[0]).toMatchObject({ waterTargetMl: 3200 })
  })

  it('records when the last backup was made', async () => {
    await exportBackup(new Date('2026-10-12T08:00:00Z'))
    expect((await repositories.settings.get()).lastBackupAt).toBe('2026-10-12T08:00:00.000Z')
  })

  it('importing the same backup twice adds nothing the second time', async () => {
    await seed()
    const data = await readAllData()
    await writeAllData(resolveImport(await readAllData(), data, 'merge'))
    await writeAllData(resolveImport(await readAllData(), data, 'merge'))
    expect(await readAllData()).toEqual(data)
  })

  it('merging keeps existing records and adds new ones', async () => {
    await seed()
    const incoming = emptyBackupData()
    incoming.runLogs = [
      { id: 'r2', date: '2026-10-14', type: 'tempo', actualDistanceKm: 5, completed: true },
    ]
    await writeAllData(resolveImport(await readAllData(), incoming, 'merge'))
    expect((await repositories.runLogs.all()).map((r) => r.id).sort()).toEqual(['r1', 'r2'])
    expect(await repositories.gymSessions.all()).toHaveLength(1)
  })
})

describe('failed import leaves data untouched', () => {
  it('rolls back everything if the write fails partway', async () => {
    await seed()
    const before = await readAllData()
    const broken = emptyBackupData()
    broken.gymSessions = [
      { id: 'new', date: '2026-10-13', title: 'x', status: 'completed', exercises: [] },
    ]
    broken.runLogs = [
      { id: 'dup', date: '2026-10-13', type: 'easy', actualDistanceKm: 1, completed: true },
      { id: 'dup', date: '2026-10-13', type: 'easy', actualDistanceKm: 2, completed: true },
    ]
    await expect(writeAllData(broken)).rejects.toThrow()
    expect(await readAllData()).toEqual(before)
  })
})

describe('resetAllData', () => {
  it('empties every table', async () => {
    await seed()
    await resetAllData()
    for (const table of db.tables) expect(await table.count(), table.name).toBe(0)
  })
})

describe('isBackupDue', () => {
  const now = new Date('2026-10-20T00:00:00Z')
  it('does not nag when there is nothing to protect', () => {
    expect(isBackupDue(undefined, false, now)).toBe(false)
  })
  it('asks for a first backup, then every two weeks', () => {
    expect(isBackupDue(undefined, true, now)).toBe(true)
    expect(isBackupDue('2026-10-15T00:00:00Z', true, now)).toBe(false)
    expect(isBackupDue('2026-10-01T00:00:00Z', true, now)).toBe(true)
  })
})
