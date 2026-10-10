import { isDateKey } from '../../domain/dates.ts'

/** Bump when the backup file shape changes, and add a migration step for older versions. */
export const BACKUP_SCHEMA_VERSION = 1

type Row = Record<string, unknown>

/** Every stored table, with the field that uniquely identifies a record in it. */
export const BACKUP_TABLES = {
  profile: { key: 'id', dated: false },
  settings: { key: 'id', dated: false },
  nutritionTargets: { key: 'effectiveFrom', dated: false },
  plannedOverrides: { key: 'id', dated: false },
  gymSessions: { key: 'id', dated: true },
  runLogs: { key: 'id', dated: true },
  foodEntries: { key: 'id', dated: true },
  bodyMeasurements: { key: 'id', dated: true },
  supplementLogs: { key: 'id', dated: true },
  waterEntries: { key: 'id', dated: true },
  reminders: { key: 'id', dated: false },
} as const

export type TableName = keyof typeof BACKUP_TABLES
export const TABLE_NAMES = Object.keys(BACKUP_TABLES) as TableName[]

export type BackupData = Record<TableName, Row[]>

export type BackupFile = {
  app: 'ironstride'
  schemaVersion: number
  exportedAt: string
  appVersion?: string
  data: BackupData
}

export const emptyBackupData = (): BackupData =>
  Object.fromEntries(TABLE_NAMES.map((t) => [t, [] as Row[]])) as BackupData

export function createBackup(
  data: BackupData,
  exportedAt: string,
  appVersion?: string,
): BackupFile {
  return { app: 'ironstride', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, appVersion, data }
}

export type ValidationResult =
  | { ok: true; data: BackupData; warnings: string[]; exportedAt: string }
  | { ok: false; errors: string[] }

const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const MAX_ERRORS = 8

/** Extra per-table sanity checks, so a corrupt file cannot put nonsense into the database. */
function checkRecord(table: TableName, r: Row): string | undefined {
  switch (table) {
    case 'gymSessions':
      if (!['in-progress', 'completed', 'skipped'].includes(String(r.status)))
        return 'has an unknown status'
      if (!Array.isArray(r.exercises)) return 'has no exercise list'
      return
    case 'runLogs':
      if (!finite(r.actualDistanceKm) || (r.actualDistanceKm as number) < 0)
        return 'has an invalid distance'
      return
    case 'foodEntries':
      for (const k of ['caloriesKcal', 'proteinG', 'carbsG', 'fatG']) {
        if (!finite(r[k]) || (r[k] as number) < 0) return `has an invalid ${k}`
      }
      return
    case 'waterEntries':
      if (!finite(r.amountMl) || (r.amountMl as number) < 0) return 'has an invalid amount'
      return
    case 'supplementLogs':
      if (!['taken', 'skipped', 'not-applicable'].includes(String(r.status)))
        return 'has an unknown status'
      return
    case 'bodyMeasurements':
      if (r.weightKg !== undefined && !finite(r.weightKg)) return 'has an invalid weight'
      return
    case 'nutritionTargets':
      if (!isDateKey(String(r.effectiveFrom))) return 'has an invalid effective date'
      return
    default:
      return
  }
}

/** Parses untrusted file contents. Never throws; returns every problem found (up to a limit). */
export function validateBackupFile(input: unknown): ValidationResult {
  if (!isObject(input)) return { ok: false, errors: ['This is not an IronStride backup file.'] }
  if (input.app !== 'ironstride')
    return { ok: false, errors: ['This file was not exported by IronStride.'] }
  if (
    typeof input.schemaVersion !== 'number' ||
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion < 1
  ) {
    return { ok: false, errors: ['The backup has no valid version number.'] }
  }
  if (input.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `This backup is from a newer version of the app (format ${input.schemaVersion}). Update IronStride first.`,
      ],
    }
  }
  if (!isObject(input.data)) return { ok: false, errors: ['The backup contains no data section.'] }

  const migrated = migrateBackupData(input.data, input.schemaVersion)
  const errors: string[] = []
  const warnings: string[] = []
  const data = emptyBackupData()

  for (const name of Object.keys(migrated)) {
    if (!(name in BACKUP_TABLES)) warnings.push(`Ignored unknown section "${name}".`)
  }

  for (const table of TABLE_NAMES) {
    const raw = migrated[table]
    if (raw === undefined) continue
    if (!Array.isArray(raw)) {
      errors.push(`"${table}" should be a list.`)
      continue
    }
    const { key, dated } = BACKUP_TABLES[table]
    const seen = new Set<string>()
    raw.forEach((record, i) => {
      const where = `${table} #${i + 1}`
      if (!isObject(record)) return errors.push(`${where} is not a record.`)
      const id = record[key]
      if (typeof id !== 'string' || id === '') return errors.push(`${where} has no ${key}.`)
      if (seen.has(id)) return errors.push(`${where} repeats ${key} "${id}".`)
      seen.add(id)
      if (dated && !isDateKey(String(record.date)))
        return errors.push(`${where} has an invalid date.`)
      const problem = checkRecord(table, record)
      if (problem) return errors.push(`${where} ${problem}.`)
      data[table].push(record)
    })
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_ERRORS)
    if (errors.length > MAX_ERRORS) shown.push(`…and ${errors.length - MAX_ERRORS} more problems.`)
    return { ok: false, errors: shown }
  }
  return {
    ok: true,
    data,
    warnings,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
  }
}

/** Brings older backup shapes up to the current one. Only version 1 exists so far. */
function migrateBackupData(data: Row, _fromVersion: number): Row {
  return data
}

/** Key order independent comparison, so identical records are recognised as duplicates. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export type TablePlan = {
  add: Row[]
  /** Same id and same content: skipped, so importing twice changes nothing. */
  same: number
  /** Same id but different content. */
  conflicts: { existing: Row; incoming: Row }[]
}

export type MergePlan = Record<TableName, TablePlan>

export function planMerge(existing: BackupData, incoming: BackupData): MergePlan {
  const plan = {} as MergePlan
  for (const table of TABLE_NAMES) {
    const { key } = BACKUP_TABLES[table]
    const byKey = new Map(existing[table].map((r) => [String(r[key]), r]))
    const t: TablePlan = { add: [], same: 0, conflicts: [] }
    for (const record of incoming[table]) {
      const current = byKey.get(String(record[key]))
      if (!current) t.add.push(record)
      else if (stable(current) === stable(record)) t.same += 1
      else t.conflicts.push({ existing: current, incoming: record })
    }
    plan[table] = t
  }
  return plan
}

export const countPlan = (plan: MergePlan) => ({
  add: TABLE_NAMES.reduce((n, t) => n + plan[t].add.length, 0),
  same: TABLE_NAMES.reduce((n, t) => n + plan[t].same, 0),
  conflicts: TABLE_NAMES.reduce((n, t) => n + plan[t].conflicts.length, 0),
})

export type ImportMode = 'merge' | 'merge-overwrite' | 'replace'

/**
 * The records each table should hold after the import. Pure, so it is easy to test.
 * - merge: keep what you have, add what is new (conflicts keep your current version)
 * - merge-overwrite: as merge, but conflicting records take the backup's version
 * - replace: exactly the backup's contents
 */
export function resolveImport(
  existing: BackupData,
  incoming: BackupData,
  mode: ImportMode,
): BackupData {
  if (mode === 'replace') return incoming
  const plan = planMerge(existing, incoming)
  const result = emptyBackupData()
  for (const table of TABLE_NAMES) {
    const { key } = BACKUP_TABLES[table]
    const replaced = new Map(
      plan[table].conflicts.map((c) => [String(c.existing[key]), c.incoming]),
    )
    result[table] = [
      ...existing[table].map((r) =>
        mode === 'merge-overwrite' ? (replaced.get(String(r[key])) ?? r) : r,
      ),
      ...plan[table].add,
    ]
  }
  return result
}

const csvCell = (value: unknown): string => {
  const text = value === undefined || value === null ? '' : String(value)
  // Quote cells with separators, quotes or line breaks, and defuse spreadsheet formulas.
  const safe = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const toCsv = (headers: readonly string[], rows: readonly (readonly unknown[])[]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'

export function runsToCsv(runs: readonly Row[]): string {
  return toCsv(
    [
      'date',
      'type',
      'planned_km',
      'distance_km',
      'duration_seconds',
      'pace_seconds_per_km',
      'rpe',
      'notes',
    ],
    [...runs]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((r) => [
        r.date,
        r.type,
        r.plannedDistanceKm,
        r.actualDistanceKm,
        r.durationSeconds,
        r.averagePaceSecondsPerKm,
        r.rpe,
        r.notes,
      ]),
  )
}

export function weightToCsv(measurements: readonly Row[]): string {
  return toCsv(
    ['date', 'weight_kg', 'waist_cm', 'notes'],
    [...measurements]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((m) => [m.date, m.weightKg, m.waistCm, m.notes]),
  )
}

/** One row per set, so the file opens as a flat table in a spreadsheet. */
export function gymToCsv(sessions: readonly Row[]): string {
  const rows: unknown[][] = []
  for (const s of [...sessions].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    for (const e of (s.exercises as Row[]) ?? []) {
      for (const set of (e.sets as Row[]) ?? []) {
        rows.push([
          s.date,
          s.title,
          s.status,
          e.exerciseNameSnapshot,
          e.skippedReason,
          set.setNumber,
          set.loadKg,
          set.reps,
          set.completed,
          set.rpe,
        ])
      }
    }
  }
  return toCsv(
    [
      'date',
      'session',
      'status',
      'exercise',
      'skipped_reason',
      'set',
      'load_kg',
      'reps',
      'completed',
      'rpe',
    ],
    rows,
  )
}
