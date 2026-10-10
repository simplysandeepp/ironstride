import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, repositories } from '../../db/repositories.ts'
import {
  addWater,
  DEFAULT_SUPPLEMENTS,
  getSupplements,
  getWaterServing,
  getWaterTarget,
  setSupplementStatus,
  supplementLogId,
  undoLastWater,
  updateSettings,
} from './habits.ts'

const D = '2026-10-12'
const creatine = DEFAULT_SUPPLEMENTS[0]

beforeEach(async () => {
  await repositories.settings.save(DEFAULT_SETTINGS)
})

describe('settings resolution', () => {
  it('uses sensible defaults and enables only creatine and protein powder', () => {
    expect(getWaterTarget(DEFAULT_SETTINGS)).toBe(3000)
    expect(getWaterServing(DEFAULT_SETTINGS)).toBe(250)
    expect(
      getSupplements(DEFAULT_SETTINGS)
        .filter((s) => s.enabled)
        .map((s) => s.key),
    ).toEqual(['creatine', 'protein-powder'])
  })

  it('prefers saved values and still lists supplements missing from saved config', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      waterTargetMl: 3500,
      supplements: [{ ...DEFAULT_SUPPLEMENTS[2], enabled: true }],
    }
    expect(getWaterTarget(settings)).toBe(3500)
    const list = getSupplements(settings)
    expect(list).toHaveLength(3)
    expect(list.find((s) => s.key === 'b12')?.enabled).toBe(true)
    expect(list.find((s) => s.key === 'creatine')?.enabled).toBe(true)
  })
})

describe('supplement logging', () => {
  it('keeps one record per supplement per day and supports all statuses', async () => {
    await setSupplementStatus(D, creatine, 'taken')
    await setSupplementStatus(D, creatine, 'taken')
    expect(await repositories.supplementLogs.onDate(D)).toHaveLength(1)
    await setSupplementStatus(D, creatine, 'skipped')
    expect((await repositories.supplementLogs.get(supplementLogId(D, 'creatine')))?.status).toBe(
      'skipped',
    )
    await setSupplementStatus(D, creatine, 'not-applicable')
    expect((await repositories.supplementLogs.onDate(D))[0].status).toBe('not-applicable')
    await setSupplementStatus(D, creatine, null)
    expect(await repositories.supplementLogs.onDate(D)).toHaveLength(0)
  })
})

describe('water', () => {
  it('undoes the newest entry regardless of storage order', async () => {
    await addWater(D, 250, new Date('2026-10-12T08:00:00Z'))
    await addWater(D, 500, new Date('2026-10-12T09:00:00Z'))
    expect((await repositories.waterEntries.onDate(D)).reduce((s, w) => s + w.amountMl, 0)).toBe(
      750,
    )
    await undoLastWater(D)
    expect((await repositories.waterEntries.onDate(D)).reduce((s, w) => s + w.amountMl, 0)).toBe(
      250,
    )
    await undoLastWater(D)
    await undoLastWater(D)
    expect(await repositories.waterEntries.onDate(D)).toHaveLength(0)
  })
})

describe('updateSettings', () => {
  it('merges into existing settings without dropping others', async () => {
    await updateSettings({ theme: 'light' })
    await updateSettings({ hideMealIdeas: true })
    expect(await repositories.settings.get()).toMatchObject({
      theme: 'light',
      hideMealIdeas: true,
      distanceUnit: 'km',
    })
  })
})
