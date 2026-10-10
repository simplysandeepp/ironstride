import { describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  countPlan,
  createBackup,
  emptyBackupData,
  gymToCsv,
  planMerge,
  resolveImport,
  runsToCsv,
  toCsv,
  validateBackupFile,
  type BackupData,
} from './backup.ts'

const run = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  date: '2026-10-12',
  type: 'easy',
  actualDistanceKm: 5,
  completed: true,
  ...over,
})

const data = (over: Partial<BackupData> = {}): BackupData => ({ ...emptyBackupData(), ...over })
const file = (d: BackupData) => JSON.parse(JSON.stringify(createBackup(d, '2026-10-12T08:00:00Z')))

describe('validateBackupFile', () => {
  it('accepts a good backup and an empty one', () => {
    expect(validateBackupFile(file(data({ runLogs: [run('a')] }))).ok).toBe(true)
    expect(validateBackupFile(file(data())).ok).toBe(true)
  })

  it('rejects things that are not backups, without throwing', () => {
    for (const bad of [null, 'text', 42, [], {}, { app: 'other' }, { app: 'ironstride' }]) {
      expect(validateBackupFile(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('rejects a backup from a newer app version with a helpful message', () => {
    const result = validateBackupFile({ ...file(data()), schemaVersion: BACKUP_SCHEMA_VERSION + 1 })
    expect(result).toMatchObject({ ok: false })
    expect(!result.ok && result.errors[0]).toMatch(/newer version/i)
  })

  it('rejects malformed records and says where', () => {
    const f = file(data())
    f.data.runLogs = [
      run('a', { actualDistanceKm: -3 }),
      run('b', { date: 'nope' }),
      { date: '2026-10-12' },
      run('a'),
    ]
    f.data.foodEntries = [
      { id: 'f', date: '2026-10-12', caloriesKcal: -1, proteinG: 1, carbsG: 1, fatG: 1 },
    ]
    f.data.gymSessions = [{ id: 'g', date: '2026-10-12', status: 'weird', exercises: [] }]
    const result = validateBackupFile(f)
    expect(result.ok).toBe(false)
    const text = !result.ok ? result.errors.join('\n') : ''
    expect(text).toMatch(/runLogs #1 has an invalid distance/)
    expect(text).toMatch(/runLogs #2 has an invalid date/)
    expect(text).toMatch(/runLogs #3 has no id/)
    expect(text).toMatch(/runLogs #4 repeats id "a"/)
    expect(text).toMatch(/foodEntries #1 has an invalid caloriesKcal/)
    expect(text).toMatch(/gymSessions #1 has an unknown status/)
  })

  it('caps how many problems it lists', () => {
    const f = file(data())
    f.data.runLogs = Array.from({ length: 30 }, (_, i) => run(`r${i}`, { actualDistanceKm: -1 }))
    const result = validateBackupFile(f)
    expect(!result.ok && result.errors.length).toBe(9)
    expect(!result.ok && result.errors.at(-1)).toMatch(/more problems/)
  })

  it('warns about unknown sections but still imports the known ones', () => {
    const f = file(data({ runLogs: [run('a')] }))
    f.data.somethingNew = [{ id: 'x' }]
    const result = validateBackupFile(f)
    expect(result.ok && result.warnings[0]).toMatch(/somethingNew/)
    expect(result.ok && result.data.runLogs).toHaveLength(1)
  })

  it('treats a non-list section as an error', () => {
    const f = file(data())
    f.data.runLogs = 'oops'
    expect(validateBackupFile(f).ok).toBe(false)
  })
})

describe('planMerge and resolveImport', () => {
  const existing = data({ runLogs: [run('a'), run('b', { actualDistanceKm: 8 })] })
  const incoming = data({ runLogs: [run('a'), run('b', { actualDistanceKm: 9 }), run('c')] })

  it('classifies new, identical and conflicting records', () => {
    const plan = planMerge(existing, incoming)
    expect(plan.runLogs.add.map((r) => r.id)).toEqual(['c'])
    expect(plan.runLogs.same).toBe(1)
    expect(plan.runLogs.conflicts).toHaveLength(1)
    expect(countPlan(plan)).toEqual({ add: 1, same: 1, conflicts: 1 })
  })

  it('recognises identical records regardless of key order, so re-importing adds nothing', () => {
    const reordered = data({
      runLogs: [
        { completed: true, actualDistanceKm: 5, type: 'easy', date: '2026-10-12', id: 'a' },
      ],
    })
    expect(planMerge(existing, reordered).runLogs.same).toBe(1)
    expect(countPlan(planMerge(existing, existing))).toEqual({ add: 0, same: 3 - 1, conflicts: 0 })
  })

  it('merge keeps current versions of conflicts', () => {
    const out = resolveImport(existing, incoming, 'merge')
    expect(out.runLogs.map((r) => [r.id, r.actualDistanceKm])).toEqual([
      ['a', 5],
      ['b', 8],
      ['c', 5],
    ])
  })

  it('merge-overwrite takes the backup version of conflicts only', () => {
    const out = resolveImport(existing, incoming, 'merge-overwrite')
    expect(out.runLogs.map((r) => [r.id, r.actualDistanceKm])).toEqual([
      ['a', 5],
      ['b', 9],
      ['c', 5],
    ])
  })

  it('replace yields exactly the backup', () => {
    expect(resolveImport(existing, incoming, 'replace')).toBe(incoming)
  })

  it('never mutates its inputs', () => {
    const snapshot = JSON.stringify(existing)
    resolveImport(existing, incoming, 'merge-overwrite')
    expect(JSON.stringify(existing)).toBe(snapshot)
  })
})

describe('csv export', () => {
  it('quotes commas, quotes and line breaks and defuses spreadsheet formulas', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'say "hi"'],
          ['line\nbreak', '=SUM(A1)'],
          ['-5', undefined],
        ],
      ),
    ).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\'=SUM(A1)\r\n-5,\r\n')
  })

  it('writes runs sorted by date with a header', () => {
    const csv = runsToCsv([
      run('b', { date: '2026-10-14' }),
      run('a', { date: '2026-10-12', notes: 'felt good' }),
    ])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toMatch(/^date,type,planned_km,distance_km/)
    expect(lines[1]).toContain('2026-10-12')
    expect(lines[1]).toContain('felt good')
    expect(lines[2]).toContain('2026-10-14')
  })

  it('writes one row per gym set', () => {
    const csv = gymToCsv([
      {
        date: '2026-10-12',
        title: 'Upper A',
        status: 'completed',
        exercises: [
          {
            exerciseNameSnapshot: 'Bench',
            sets: [
              { setNumber: 1, loadKg: 40, reps: 8, completed: true },
              { setNumber: 2, loadKg: 40, reps: 7, completed: true },
            ],
          },
        ],
      },
    ])
    expect(csv.trim().split('\r\n')).toHaveLength(3)
    expect(csv).toContain('2026-10-12,Upper A,completed,Bench,,1,40,8,true')
  })
})
