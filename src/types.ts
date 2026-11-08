export type WeightUnit = 'kg' | 'lb'
export type LengthUnit = 'in' | 'cm'
export type Theme = 'system' | 'light' | 'dark'
export type RepUnit = 'reps' | 'sec'

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Full body',
  'Cardio',
  'Other',
] as const

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Plate-loaded',
  'Smith machine',
  'Bodyweight',
  'Kettlebell',
  'Band',
  'Other',
] as const

export interface Exercise {
  id: string
  name: string
  muscle: string
  equipment: string
  notes: string
  createdAt: number
}

/** One line of a session. More than one exercise id = a superset; `sets` is then the number of rounds. */
export interface PlanItem {
  id: string
  exerciseIds: string[]
  sets: number
  repMin: number
  repMax: number
  repUnit: RepUnit
  perSide: boolean
  dropLast: boolean
  notes: string
  restSec?: number | null
}

export interface Session {
  id: string
  name: string
  items: PlanItem[]
}

export interface PlanDay {
  id: string
  name: string
  /** 0 = Sunday … 6 = Saturday, null = not tied to a weekday */
  weekday: number | null
  rest: boolean
  includeAbs: boolean
  sessions: Session[]
}

export interface Plan {
  id: string
  name: string
  days: PlanDay[]
  absRoutine: PlanItem[]
  createdAt: number
  updatedAt: number
}

/** Weight is always stored in kg. For time-based exercises `reps` holds seconds. */
export interface SetLog {
  weight: number | null
  reps: number | null
  done: boolean
  drop?: boolean
}

export interface EntryTarget {
  sets: number
  repMin: number
  repMax: number
  repUnit: RepUnit
  perSide: boolean
  dropLast: boolean
}

export interface WorkoutEntry {
  id: string
  exerciseId: string
  planItemId?: string | null
  /** Entries sharing a groupId form a superset. */
  groupId?: string | null
  target?: EntryTarget | null
  /** Notes copied from the plan item (cues), read-only while logging. */
  cue?: string
  restSec?: number | null
  notes: string
  sets: SetLog[]
  isAbs?: boolean
}

export interface Workout {
  id: string
  /** Local date, YYYY-MM-DD */
  date: string
  startedAt: number
  finishedAt: number | null
  planId?: string | null
  dayId?: string | null
  sessionId?: string | null
  title: string
  entries: WorkoutEntry[]
  notes: string
}

export interface BodyLog {
  id: string // = date
  date: string
  weightKg: number | null
  waistIn: number | null
}

export interface HabitLog {
  id: string // = date
  date: string
  meals: number | null
  proteinMeals: number | null
  workoutDone: boolean
  energy: number | null
}

export interface Settings {
  weightUnit: WeightUnit
  lengthUnit: LengthUnit
  theme: Theme
  restSec: number
  supersetRestSec: number
  autoStartRest: boolean
  stepKg: number
  stepLb: number
  startWeightKg: number | null
  goalWeightKg: number | null
  startWaistIn: number | null
  goalWaistIn: number | null
  startDate: string
  measureEveryDays: number
  weekStartsOn: 0 | 1
  activePlanId: string | null
  seededAt: number
}

export type CollectionName = 'settings' | 'exercises' | 'plans' | 'workouts' | 'bodyLogs' | 'habitLogs'
