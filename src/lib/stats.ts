import type { Exercise, Workout } from '../types'
import { bestE1rm, completedSets, historyFor, sessionVolume, topWeight, workingSets } from './progression'
import { addDays, startOfWeek } from './dates'

export interface ExercisePoint {
  date: string
  heaviest: number
  volume: number
  e1rm: number
}

/** One point per session for a given exercise, oldest first. Values in kg. */
export function exerciseSeries(workouts: Workout[], exerciseId: string): ExercisePoint[] {
  return historyFor(workouts, exerciseId)
    .filter((h) => workingSets(h.sets).length > 0)
    .map((h) => ({
      date: h.date,
      heaviest: topWeight(h.sets),
      volume: Math.round(sessionVolume(h.sets)),
      e1rm: Math.round(bestE1rm(h.sets) * 10) / 10,
    }))
    .reverse()
}

export interface WeekMuscleRow {
  week: string
  [muscle: string]: number | string
}

/**
 * Completed working sets per muscle group per week, for `weeks` weeks ending with the week of `today`.
 * Drop sets are not counted as extra sets.
 */
export function weeklyMuscleSets(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  today: string,
  weeks: number,
  weekStartsOn: 0 | 1 = 1,
): { rows: WeekMuscleRow[]; muscles: string[] } {
  const thisWeek = startOfWeek(today, weekStartsOn)
  const starts = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (weeks - 1 - i)))
  const rows = new Map<string, WeekMuscleRow>(starts.map((s) => [s, { week: s }]))
  const muscles = new Set<string>()
  for (const w of workouts) {
    const row = rows.get(startOfWeek(w.date, weekStartsOn))
    if (!row) continue
    for (const e of w.entries) {
      const n = workingSets(e.sets).length
      if (!n) continue
      const m = exMap.get(e.exerciseId)?.muscle || 'Other'
      muscles.add(m)
      row[m] = ((row[m] as number) || 0) + n
    }
  }
  const list = [...muscles].sort()
  for (const r of rows.values()) for (const m of list) if (r[m] == null) r[m] = 0
  return { rows: [...rows.values()], muscles: list }
}

export interface WorkoutSummary {
  sets: number
  volume: number
  exercises: number
}

export function summarizeWorkout(w: Workout): WorkoutSummary {
  let sets = 0
  let volume = 0
  let exercises = 0
  for (const e of w.entries) {
    const done = completedSets(e.sets)
    if (done.length) exercises++
    sets += workingSets(e.sets).length
    volume += sessionVolume(e.sets)
  }
  return { sets, volume: Math.round(volume), exercises }
}

/** Exercise ids ordered by how many sessions they appear in (most first). */
export function exercisesByFrequency(workouts: Workout[]): string[] {
  const count = new Map<string, number>()
  for (const w of workouts) {
    const seen = new Set<string>()
    for (const e of w.entries) if (workingSets(e.sets).length && !seen.has(e.exerciseId)) seen.add(e.exerciseId)
    seen.forEach((id) => count.set(id, (count.get(id) || 0) + 1))
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
