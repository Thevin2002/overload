import type { Exercise, Plan, PlanDay, PlanItem } from '../types'
import { newId } from './id'

export function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (j < 0 || j >= arr.length) return arr
  const out = [...arr]
  ;[out[index], out[j]] = [out[j], out[index]]
  return out
}

export function targetLabel(it: Pick<PlanItem, 'sets' | 'repMin' | 'repMax' | 'repUnit' | 'perSide' | 'exerciseIds'>): string {
  const reps = it.repMin === it.repMax ? `${it.repMin}` : `${it.repMin}–${it.repMax}`
  const unit = it.repUnit === 'sec' ? 's' : ''
  const side = it.perSide ? '/side' : ''
  const sets = it.exerciseIds.length > 1 ? `${it.sets} rounds` : `${it.sets} ×`
  return it.exerciseIds.length > 1 ? `${sets} · ${reps}${unit}${side}` : `${sets} ${reps}${unit}${side}`
}

export function itemNames(it: PlanItem, exMap: Map<string, Exercise>): string {
  return it.exerciseIds.map((id) => exMap.get(id)?.name ?? 'Unknown exercise').join(' + ')
}

export function newItem(exerciseIds: string[], opts: Partial<PlanItem> = {}): PlanItem {
  const superset = exerciseIds.length > 1
  return {
    id: newId(),
    exerciseIds,
    sets: superset ? 2 : 3,
    repMin: superset ? 12 : 8,
    repMax: superset ? 15 : 12,
    repUnit: 'reps',
    perSide: false,
    dropLast: false,
    notes: '',
    restSec: null,
    ...opts,
  }
}

export function newDay(name = 'New day', weekday: number | null = null): PlanDay {
  return { id: newId(), name, weekday, rest: false, includeAbs: false, sessions: [{ id: newId(), name: 'Main', items: [] }] }
}

export function newPlan(name: string): Plan {
  const now = Date.now()
  return { id: newId(), name, days: [], absRoutine: [], createdAt: now, updatedAt: now }
}

/** Deep copy with fresh ids. */
export function duplicatePlan(p: Plan, name: string): Plan {
  const now = Date.now()
  const reItem = (i: PlanItem) => ({ ...i, id: newId() })
  return {
    ...p,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    absRoutine: p.absRoutine.map(reItem),
    days: p.days.map((d) => ({ ...d, id: newId(), sessions: d.sessions.map((s) => ({ ...s, id: newId(), items: s.items.map(reItem) })) })),
  }
}

/** The plan day scheduled for a weekday (first match). */
export function dayForWeekday(plan: Plan | null, weekday: number): PlanDay | null {
  return plan?.days.find((d) => d.weekday === weekday) ?? null
}

export function exerciseCount(day: PlanDay): number {
  return day.sessions.reduce((n, s) => n + s.items.reduce((m, i) => m + i.exerciseIds.length, 0), 0)
}

/** Plan days that reference an exercise — used to warn before deleting it. */
export function usagesOf(exerciseId: string, plans: Plan[]): string[] {
  const out: string[] = []
  for (const p of plans) {
    if (p.absRoutine.some((i) => i.exerciseIds.includes(exerciseId))) out.push(`${p.name} · Abs`)
    for (const d of p.days) if (d.sessions.some((s) => s.items.some((i) => i.exerciseIds.includes(exerciseId)))) out.push(`${p.name} · ${d.name}`)
  }
  return out
}
