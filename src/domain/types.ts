import type { DateKey } from './dates.ts'

export type ActivityType = 'gym' | 'run' | 'nutrition' | 'recovery'

export type UserProfile = {
  id: 'local-user'
  heightCm: number
  currentWeightKg: number
  targetWeightMinKg: number
  targetWeightMaxKg: number
  ageRange: string
  dietaryPattern: 'vegan'
  weeklyRunBaselineKm: number
  recentLongRunKm: number
  gymDaysPerWeek: number
  runDaysPerWeek: number
  gymSessionMinutes: number
  trainingStartDate: DateKey
  createdAt: string
  updatedAt: string
}

/** Targets are stored with an effective date so history is never rewritten. */
export type NutritionTargets = {
  caloriesKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  effectiveFrom: DateKey
}

export type PlannedWorkoutType =
  'gym' | 'easy-run' | 'interval-run' | 'tempo-run' | 'long-run' | 'rest' | 'recovery'

/** A user edit layered over the default programme (stored separately from it). */
export type PlannedWorkoutOverride = {
  id: string
  weekNumber: number
  dayOfWeek: number
  type?: PlannedWorkoutType
  title?: string
  notes?: string
  plannedDistanceKm?: number
  estimatedMinutes?: number
}

export type GymSetLog = {
  id: string
  setNumber: number
  loadKg?: number
  reps?: number
  completed: boolean
  rpe?: number
  notes?: string
}

export type GymExerciseLog = {
  exerciseId: string
  exerciseNameSnapshot: string
  sets: GymSetLog[]
  skippedReason?: string
  /** Set when this exercise replaced a planned one. */
  substitutedFromId?: string
  notes?: string
}

export type GymSession = {
  id: string
  date: DateKey
  plannedWorkoutId?: string
  title: string
  status: 'in-progress' | 'completed' | 'skipped'
  startedAt?: string
  finishedAt?: string
  exercises: GymExerciseLog[]
  sessionRpe?: number
  notes?: string
}

export type RunType = 'easy' | 'interval' | 'tempo' | 'long' | 'recovery' | 'other'

export type RunLog = {
  id: string
  date: DateKey
  plannedWorkoutId?: string
  type: RunType
  plannedDistanceKm?: number
  actualDistanceKm: number
  durationSeconds?: number
  averagePaceSecondsPerKm?: number
  rpe?: number
  notes?: string
  completed: boolean
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-workout' | 'post-workout'

export type FoodEntry = {
  id: string
  date: DateKey
  time?: string
  meal: MealType
  name: string
  quantity: number
  unit: string
  caloriesKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG?: number
  notes?: string
  favourite?: boolean
}

export type BodyMeasurement = {
  id: string
  date: DateKey
  weightKg?: number
  waistCm?: number
  notes?: string
}

export type SupplementLog = {
  id: string
  date: DateKey
  supplement: string
  amount: number
  unit: string
  status: 'taken' | 'skipped' | 'not-applicable'
}

export type WaterEntry = {
  id: string
  date: DateKey
  amountMl: number
}

export type Reminder = {
  id: string
  title: string
  type: 'gym' | 'run' | 'meal' | 'water' | 'supplement' | 'review'
  enabled: boolean
  timeLocal: string
  weekdays: number[]
}

export type SupplementConfig = {
  key: string
  label: string
  amount: number
  unit: string
  enabled: boolean
}

export type AppSettings = {
  id: 'app'
  theme: 'dark' | 'light' | 'system'
  distanceUnit: 'km' | 'mi'
  weightUnit: 'kg' | 'lb'
  onboardingCompleted: boolean
  notificationsEnabled: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
  waterTargetMl?: number
  waterServingMl?: number
  supplements?: SupplementConfig[]
  hideMealIdeas?: boolean
}

export type ExerciseCategory =
  | 'chest'
  | 'vertical-pull'
  | 'horizontal-pull'
  | 'shoulders'
  | 'arms'
  | 'squat'
  | 'hinge'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'

export type ExerciseDefinition = {
  id: string
  name: string
  category: ExerciseCategory
  primaryMuscles: string[]
  equipment: string[]
  /** Short technique cues, in order. */
  instructions: string[]
  safetyNote: string
  /** Ids of equivalent exercises the user can swap in. */
  substitutions: string[]
  defaultSets: number
  /** Rep range, or seconds when `measure` is "seconds". */
  repRange: [number, number]
  measure: 'reps' | 'seconds'
  restSeconds: number
}
