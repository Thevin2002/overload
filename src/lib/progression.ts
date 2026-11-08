import type { RepUnit, SetLog, Workout } from '../types'

/** One past session of a single exercise (all its sets that day). Weights in kg. */
export interface ExerciseSession {
  date: string
  workoutId: string
  sets: SetLog[]
}

export interface Target {
  sets: number
  repMin: number
  repMax: number
  repUnit?: RepUnit
}

export type Suggestion =
  | { kind: 'start'; message: string }
  | { kind: 'increase'; weightKg: number; reps: number; message: string }
  | { kind: 'hold'; weightKg: number; reps: number; message: string }

const EPS = 1e-6

/** Completed, non-drop sets with reps > 0. Drop sets never drive progression. */
export function workingSets(sets: SetLog[]): SetLog[] {
  return sets.filter((s) => s.done && !s.drop && (s.reps ?? 0) > 0)
}

/** Completed sets (including drop sets) with reps > 0. */
export function completedSets(sets: SetLog[]): SetLog[] {
  return sets.filter((s) => s.done && (s.reps ?? 0) > 0)
}

/** Estimated one-rep max (Epley). */
export function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function topWeight(sets: SetLog[]): number {
  return workingSets(sets).reduce((m, s) => Math.max(m, s.weight ?? 0), 0)
}

export function sessionVolume(sets: SetLog[]): number {
  return completedSets(sets).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
}

export function bestE1rm(sets: SetLog[]): number {
  return workingSets(sets).reduce((m, s) => Math.max(m, e1rm(s.weight ?? 0, s.reps ?? 0)), 0)
}

function avgReps(sets: SetLog[]): number {
  const ws = workingSets(sets)
  return ws.length ? ws.reduce((s, x) => s + (x.reps ?? 0), 0) / ws.length : 0
}

/** Round to the nearest increment (e.g. 0.5 kg) to avoid 62.49999 style values. */
export function roundTo(n: number, inc = 0.25): number {
  return Math.round(n / inc) * inc
}

/**
 * Double progression.
 * - All target sets reached the top of the rep range → add `stepKg` and go back to the bottom of the range.
 * - Otherwise → keep the weight and try to add a rep to the weakest set.
 * `history` is newest first and must not include the session being logged.
 */
export function suggestNext(target: Target, history: ExerciseSession[], stepKg: number): Suggestion {
  const last = history.find((h) => workingSets(h.sets).length > 0)
  if (!last) {
    return {
      kind: 'start',
      message: `First time — pick a weight you can do for ${target.repMin}–${target.repMax} ${unitLabel(target)}.`,
    }
  }
  const ws = workingSets(last.sets)
  const top = topWeight(last.sets)
  const neededSets = Math.max(1, target.sets)
  const allAtTop = ws.length >= neededSets && ws.every((s) => (s.reps ?? 0) >= target.repMax)

  if (allAtTop) {
    const next = roundTo(top + stepKg)
    if (target.repUnit === 'sec' && top <= EPS) {
      return {
        kind: 'increase',
        weightKg: next,
        reps: target.repMin,
        message: `Held ${target.repMax}s on every set — add load or a harder variation.`,
      }
    }
    return {
      kind: 'increase',
      weightKg: next,
      reps: target.repMin,
      message:
        top <= EPS
          ? `Top of the range on every set — add ${fmt(stepKg)} kg of load (or a harder variation) and drop to ${target.repMin} ${unitLabel(target)}.`
          : `All sets hit ${target.repMax} — go up to ${fmt(next)} kg and aim for ${target.repMin}+ ${unitLabel(target)}.`,
    }
  }

  const minReps = Math.min(...ws.map((s) => s.reps ?? 0))
  const goal = Math.min(target.repMax, Math.max(target.repMin, minReps + 1))
  return {
    kind: 'hold',
    weightKg: top,
    reps: goal,
    message: `Stay at ${fmt(top)} kg and beat last time — aim for ${goal}+ ${unitLabel(target)} on every set.`,
  }
}

/**
 * True when performance dropped two sessions in a row: in each of the last two comparisons the
 * weight was the same or lower AND the average reps per working set went down.
 * `history` is newest first (may include the session just finished).
 */
export function needsRecoveryCheck(history: ExerciseSession[]): boolean {
  const sessions = history.filter((h) => workingSets(h.sets).length > 0).slice(0, 3)
  if (sessions.length < 3) return false
  const dropped = (newer: ExerciseSession, older: ExerciseSession) =>
    topWeight(newer.sets) <= topWeight(older.sets) + EPS && avgReps(newer.sets) < avgReps(older.sets) - EPS
  return dropped(sessions[0], sessions[1]) && dropped(sessions[1], sessions[2])
}

export const RECOVERY_HINT =
  'Reps have dipped two sessions in a row. Check food, sleep and recovery before pushing harder — a lighter week can help.'

export interface Bests {
  maxWeight: number
  maxE1rm: number
  maxVolume: number
  /** best reps ever achieved at each weight (key = weight rounded to 0.01 kg) */
  repsAtWeight: Map<string, number>
  sessions: number
}

const wKey = (w: number) => (Math.round(w * 100) / 100).toFixed(2)

export function computeBests(history: ExerciseSession[]): Bests {
  const b: Bests = { maxWeight: 0, maxE1rm: 0, maxVolume: 0, repsAtWeight: new Map(), sessions: 0 }
  for (const h of history) {
    const ws = workingSets(h.sets)
    if (!ws.length) continue
    b.sessions++
    b.maxVolume = Math.max(b.maxVolume, sessionVolume(h.sets))
    for (const s of ws) {
      const w = s.weight ?? 0
      const r = s.reps ?? 0
      b.maxWeight = Math.max(b.maxWeight, w)
      b.maxE1rm = Math.max(b.maxE1rm, e1rm(w, r))
      const k = wKey(w)
      b.repsAtWeight.set(k, Math.max(b.repsAtWeight.get(k) ?? 0, r))
    }
  }
  return b
}

export type PRKind = 'weight' | 'e1rm' | 'reps'

/** PRs for a single set compared with all previous sessions. The very first session is never a PR. */
export function setPRs(set: SetLog, bests: Bests): PRKind[] {
  if (!set.done || set.drop || !set.reps || bests.sessions === 0) return []
  const w = set.weight ?? 0
  const out: PRKind[] = []
  if (w > bests.maxWeight + EPS) out.push('weight')
  if (w > 0 && e1rm(w, set.reps) > bests.maxE1rm + 0.05) out.push('e1rm')
  const prevReps = bests.repsAtWeight.get(wKey(w))
  if (prevReps != null && set.reps > prevReps) out.push('reps')
  return out
}

export function sessionPRs(sets: SetLog[], bests: Bests): { volume: boolean; sets: PRKind[][] } {
  return {
    volume: bests.sessions > 0 && sessionVolume(sets) > bests.maxVolume + EPS && sessionVolume(sets) > 0,
    sets: sets.map((s) => setPRs(s, bests)),
  }
}

/**
 * Collect every session of `exerciseId` from workouts (any order), newest first, merging multiple
 * entries of the same exercise within one workout. `excludeWorkoutId` skips the workout being logged.
 */
export function historyFor(workouts: Workout[], exerciseId: string, excludeWorkoutId?: string): ExerciseSession[] {
  const out: ExerciseSession[] = []
  for (const w of workouts) {
    if (w.id === excludeWorkoutId) continue
    const sets = w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
    if (sets.some((s) => s.done)) out.push({ date: w.date, workoutId: w.id, sets })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function unitLabel(t: Target) {
  return t.repUnit === 'sec' ? 'sec' : 'reps'
}

function fmt(n: number) {
  return String(Math.round(n * 100) / 100)
}
