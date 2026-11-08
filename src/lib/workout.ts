import type { PlanDay, PlanItem, Session, SetLog, Workout, WorkoutEntry } from '../types'
import { historyFor, suggestNext } from './progression'
import { newId } from './id'
import { todayISO } from './dates'

/** Create the entries for one plan item (supersets become several entries sharing a groupId). */
export function entriesForItem(item: PlanItem, history: Workout[], stepKg: number, isAbs = false): WorkoutEntry[] {
  const superset = item.exerciseIds.length > 1
  return item.exerciseIds.map((exerciseId) => {
    const target = { sets: item.sets, repMin: item.repMin, repMax: item.repMax, repUnit: item.repUnit, perSide: item.perSide, dropLast: item.dropLast }
    const sug = suggestNext(target, historyFor(history, exerciseId), stepKg)
    const weight = sug.kind === 'start' ? null : sug.weightKg
    const sets: SetLog[] = Array.from({ length: Math.max(1, item.sets) }, () => ({ weight, reps: null, done: false }))
    if (item.dropLast) sets.push({ weight: null, reps: null, done: false, drop: true })
    return {
      id: newId(),
      exerciseId,
      planItemId: item.id,
      groupId: superset ? item.id : null,
      target,
      cue: item.notes || '',
      restSec: item.restSec ?? null,
      notes: '',
      sets,
      ...(isAbs ? { isAbs: true } : {}),
    }
  })
}

export function buildWorkout(opts: {
  planId: string | null
  day: PlanDay | null
  session: Session | null
  absRoutine: PlanItem[]
  includeAbs: boolean
  history: Workout[]
  stepKg: number
  date?: string
}): Workout {
  const { day, session, history, stepKg } = opts
  const entries = (session?.items ?? []).flatMap((it) => entriesForItem(it, history, stepKg))
  if (opts.includeAbs) entries.push(...opts.absRoutine.flatMap((it) => entriesForItem(it, history, stepKg, true)))
  const title = day ? (day.sessions.length > 1 && session ? `${day.name} · ${session.name}` : day.name) : 'Workout'
  return {
    id: newId(),
    date: opts.date ?? todayISO(),
    startedAt: Date.now(),
    finishedAt: null,
    planId: opts.planId,
    dayId: day?.id ?? null,
    sessionId: session?.id ?? null,
    title,
    entries,
    notes: '',
  }
}

/** Split entries into display blocks: single exercises, or consecutive entries sharing a groupId. */
export function groupEntries(entries: WorkoutEntry[]): { key: string; indexes: number[] }[] {
  const blocks: { key: string; indexes: number[] }[] = []
  entries.forEach((e, i) => {
    const prev = blocks[blocks.length - 1]
    if (e.groupId && prev && entries[prev.indexes[0]].groupId === e.groupId) prev.indexes.push(i)
    else blocks.push({ key: e.id, indexes: [i] })
  })
  return blocks
}
