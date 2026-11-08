import type { Exercise, Plan, PlanDay, PlanItem, RepUnit, Settings } from '../types'
import { slugId } from '../lib/id'
import { todayISO } from '../lib/dates'

type ExDef = [name: string, muscle: string, equipment: string, notes?: string]

const EXERCISES: ExDef[] = [
  // Abs
  ['Reverse crunch', 'Abs', 'Bodyweight'],
  ['Hanging knee raise', 'Abs', 'Bodyweight'],
  ['Plank', 'Abs', 'Bodyweight', 'Timed hold — log seconds.'],
  // Back
  ['Lat pulldown', 'Back', 'Cable'],
  ['T-bar / plate row', 'Back', 'Plate-loaded'],
  ['Seated cable row', 'Back', 'Cable'],
  ['Straight-arm pulldown', 'Back', 'Cable'],
  ['Reverse-grip pulldown', 'Back', 'Cable'],
  ['Single-arm cable row', 'Back', 'Cable'],
  ['Plate-loaded high row', 'Back', 'Plate-loaded'],
  // Biceps
  ['Barbell curl', 'Biceps', 'Barbell'],
  ['DB hammer curl', 'Biceps', 'Dumbbell'],
  ['Cable curl', 'Biceps', 'Cable'],
  ['Reverse-grip cable curl', 'Biceps', 'Cable', 'Also hits forearms / brachioradialis.'],
  ['Preacher curl', 'Biceps', 'Machine'],
  ['Incline DB curl', 'Biceps', 'Dumbbell'],
  // Chest
  ['Incline DB press', 'Chest', 'Dumbbell'],
  ['Machine chest press', 'Chest', 'Machine'],
  ['DB fly', 'Chest', 'Dumbbell'],
  ['Push-ups', 'Chest', 'Bodyweight'],
  ['Flat DB press', 'Chest', 'Dumbbell'],
  ['Smith incline press', 'Chest', 'Smith machine'],
  ['Decline DB press', 'Chest', 'Dumbbell'],
  // Shoulders
  ['DB shoulder press', 'Shoulders', 'Dumbbell'],
  ['DB lateral raise', 'Shoulders', 'Dumbbell'],
  ['Face pulls', 'Shoulders', 'Cable', 'Rear delts / upper back.'],
  ['Rear-delt cable fly', 'Shoulders', 'Cable'],
  ['Seated shoulder press machine', 'Shoulders', 'Machine'],
  ['Cable lateral raise', 'Shoulders', 'Cable'],
  ['DB front raise', 'Shoulders', 'Dumbbell'],
  // Legs
  ['Leg press', 'Quads', 'Machine'],
  ['Reverse lunges', 'Quads', 'Dumbbell', 'Reps are per leg.'],
  ['Seated leg curl', 'Hamstrings', 'Machine'],
  ['Lying leg curl', 'Hamstrings', 'Machine'],
  ['Leg extension', 'Quads', 'Machine'],
  ['Standing calf raise', 'Calves', 'Machine'],
  ['Seated calf raise', 'Calves', 'Machine'],
  // Triceps
  ['DB overhead extension', 'Triceps', 'Dumbbell'],
  ['V-bar pushdown', 'Triceps', 'Cable'],
  ['Single-arm cable extension', 'Triceps', 'Cable'],
  ['Reverse-grip pushdown', 'Triceps', 'Cable'],
  ['Rope pushdown', 'Triceps', 'Cable'],
  ['Cable overhead extension', 'Triceps', 'Cable'],
]

export function seedExercises(now = Date.now()): Exercise[] {
  return EXERCISES.map(([name, muscle, equipment, notes]) => ({
    id: slugId(name),
    name,
    muscle,
    equipment,
    notes: notes ?? '',
    createdAt: now,
  }))
}

let itemCounter = 0
function item(
  names: string | string[],
  sets: number,
  repMin: number,
  repMax: number,
  opts: { drop?: boolean; perSide?: boolean; unit?: RepUnit; notes?: string } = {},
): PlanItem {
  const list = Array.isArray(names) ? names : [names]
  return {
    id: `item-${++itemCounter}`,
    exerciseIds: list.map(slugId),
    sets,
    repMin,
    repMax,
    repUnit: opts.unit ?? 'reps',
    perSide: opts.perSide ?? false,
    dropLast: opts.drop ?? false,
    notes: opts.notes ?? '',
    restSec: null,
  }
}

function day(id: string, name: string, weekday: number, includeAbs: boolean, items: PlanItem[]): PlanDay {
  return { id, name, weekday, rest: false, includeAbs, sessions: [{ id: `${id}-main`, name: 'Main', items }] }
}

export const DEFAULT_PLAN_ID = 'default-ppl'

export function seedPlan(now = Date.now()): Plan {
  itemCounter = 0
  const days: PlanDay[] = [
    day('mon', 'Back + Biceps A', 1, true, [
      item('Lat pulldown', 3, 8, 12),
      item('T-bar / plate row', 3, 8, 12),
      item('Seated cable row', 3, 10, 12),
      item('Straight-arm pulldown', 2, 12, 15),
      item('Barbell curl', 3, 8, 12),
      item('DB hammer curl', 2, 10, 12, { drop: true }),
      item(['Cable curl', 'Reverse-grip cable curl'], 2, 12, 15),
    ]),
    day('tue', 'Chest + Shoulders A', 2, false, [
      item('Incline DB press', 3, 8, 12),
      item('Machine chest press', 3, 8, 12),
      item('DB fly', 2, 12, 15),
      item('DB shoulder press', 3, 8, 12),
      item('DB lateral raise', 4, 12, 15, { drop: true }),
      item('Face pulls', 3, 12, 15),
      item(['Push-ups', 'Rear-delt cable fly'], 2, 12, 15),
    ]),
    day('wed', 'Legs + Triceps A', 3, true, [
      item('Leg press', 3, 10, 12),
      item('Reverse lunges', 2, 8, 10, { perSide: true }),
      item('Seated leg curl', 3, 10, 15, { drop: true }),
      item('Standing calf raise', 4, 15, 20),
      item('DB overhead extension', 3, 10, 12),
      item('V-bar pushdown', 3, 10, 15),
      item(['Single-arm cable extension', 'Reverse-grip pushdown'], 2, 12, 15),
    ]),
    day('thu', 'Back + Biceps B', 4, false, [
      item('Reverse-grip pulldown', 3, 8, 12),
      item('Single-arm cable row', 3, 8, 12),
      item('Plate-loaded high row', 3, 8, 12),
      item('Face pulls', 3, 12, 15, { drop: true }),
      item('Preacher curl', 3, 10, 12),
      item('Incline DB curl', 2, 10, 12),
      item(['Straight-arm pulldown', 'DB hammer curl'], 2, 12, 15),
    ]),
    day('fri', 'Chest + Shoulders B', 5, true, [
      item('Flat DB press', 3, 8, 12),
      item('Smith incline press', 3, 8, 12),
      item('Decline DB press', 2, 8, 12),
      item('Seated shoulder press machine', 3, 8, 12),
      item('Cable lateral raise', 4, 12, 15, { drop: true }),
      item('Rear-delt cable fly', 3, 12, 15),
      item(['DB front raise', 'DB lateral raise'], 2, 12, 15),
    ]),
    day('sat', 'Legs + Triceps B', 6, false, [
      item('Leg press', 3, 10, 12),
      item('Lying leg curl', 3, 10, 15),
      item('Leg extension', 2, 12, 15, { drop: true }),
      item('Seated calf raise', 3, 15, 20),
      item('Rope pushdown', 3, 10, 15),
      item('Cable overhead extension', 2, 10, 12),
      item(['Cable curl', 'Reverse-grip pushdown'], 2, 12, 15),
    ]),
    { id: 'sun', name: 'Rest', weekday: 0, rest: true, includeAbs: false, sessions: [] },
  ]

  const absRoutine: PlanItem[] = [
    item('Reverse crunch', 3, 12, 15),
    item('Hanging knee raise', 3, 8, 12),
    item('Plank', 3, 30, 60, { unit: 'sec' }),
  ]

  return { id: DEFAULT_PLAN_ID, name: 'My split', days, absRoutine, createdAt: now, updatedAt: now }
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    weightUnit: 'kg',
    lengthUnit: 'in',
    theme: 'system',
    restSec: 90,
    supersetRestSec: 60,
    autoStartRest: true,
    stepKg: 2.5,
    stepLb: 5,
    startWeightKg: 66,
    goalWeightKg: 63,
    startWaistIn: 33,
    goalWaistIn: 32,
    startDate: todayISO(),
    measureEveryDays: 14,
    weekStartsOn: 1,
    activePlanId: DEFAULT_PLAN_ID,
    seededAt: now,
  }
}
