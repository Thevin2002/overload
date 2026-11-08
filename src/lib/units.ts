import type { LengthUnit, WeightUnit } from '../types'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export function round(n: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** kg (stored) → number in the user's unit */
export function kgTo(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

/** number in the user's unit → kg (stored) */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function inTo(inches: number, unit: LengthUnit): number {
  return unit === 'in' ? inches : inches * CM_PER_IN
}

export function toIn(value: number, unit: LengthUnit): number {
  return unit === 'in' ? value : value / CM_PER_IN
}

/** Trim trailing zeros: 60 → "60", 62.5 → "62.5", 62.25 → "62.25" */
export function fmtNum(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return '–'
  return String(round(n, dp))
}

export function fmtWeight(kg: number | null | undefined, unit: WeightUnit, withUnit = true): string {
  if (kg == null) return '–'
  const v = fmtNum(kgTo(kg, unit), 1)
  return withUnit ? `${v} ${unit}` : v
}

export function fmtLength(inches: number | null | undefined, unit: LengthUnit, withUnit = true): string {
  if (inches == null) return '–'
  const v = fmtNum(inTo(inches, unit), 1)
  return withUnit ? `${v} ${unit}` : v
}

/** Parse user-typed numbers, accepting "62,5" as well as "62.5". */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
