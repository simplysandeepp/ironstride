import { describe, expect, it } from 'vitest'
import {
  defaultProfileValues,
  nextMonday,
  profileToValues,
  toProfile,
  validateProfileValues,
} from './profileValues.ts'

describe('nextMonday', () => {
  it('returns the same day on a Monday and the following Monday otherwise', () => {
    expect(nextMonday('2026-10-12')).toBe('2026-10-12')
    expect(nextMonday('2026-10-10')).toBe('2026-10-12') // Saturday
    expect(nextMonday('2026-10-11')).toBe('2026-10-12') // Sunday
    expect(nextMonday('2026-10-13')).toBe('2026-10-19') // Tuesday
  })
})

describe('validateProfileValues', () => {
  const ok = defaultProfileValues('2026-10-10')

  it('accepts the defaults', () => {
    expect(validateProfileValues(ok)).toEqual({})
  })

  it('explains each invalid field', () => {
    const errors = validateProfileValues({
      ...ok,
      trainingStartDate: '',
      currentWeightKg: '',
      heightCm: '10',
      caloriesKcal: 'abc',
    })
    expect(Object.keys(errors).sort()).toEqual([
      'caloriesKcal',
      'currentWeightKg',
      'heightCm',
      'trainingStartDate',
    ])
    expect(errors.heightCm).toContain('between')
  })

  it('rejects a target range that is upside down', () => {
    const errors = validateProfileValues({
      ...ok,
      targetWeightMinKg: '80',
      targetWeightMaxKg: '70',
    })
    expect(errors.targetWeightMaxKg).toBeDefined()
  })
})

describe('toProfile', () => {
  it('keeps createdAt and untouched fields when editing', () => {
    const existing = toProfile(
      defaultProfileValues('2026-10-10'),
      undefined,
      '2026-10-10T00:00:00Z',
    )
    const edited = toProfile(
      { ...defaultProfileValues('2026-10-10'), currentWeightKg: '67.5' },
      { ...existing, gymSessionMinutes: 50 },
      '2026-10-20T00:00:00Z',
    )
    expect(edited.createdAt).toBe('2026-10-10T00:00:00Z')
    expect(edited.updatedAt).toBe('2026-10-20T00:00:00Z')
    expect(edited.gymSessionMinutes).toBe(50)
    expect(edited.currentWeightKg).toBe(67.5)
  })

  it('round-trips through form values', () => {
    const profile = toProfile(defaultProfileValues('2026-10-10'), undefined, '2026-10-10T00:00:00Z')
    const values = profileToValues(profile, { caloriesKcal: 2700, proteinG: 130 })
    expect(values).toEqual(defaultProfileValues('2026-10-10'))
  })
})
