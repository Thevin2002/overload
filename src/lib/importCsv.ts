import { parseCSV } from './csv'
import { toISODate } from './dates'
import { toIn, toKg } from './units'
import type { LengthUnit, SetLog, WeightUnit } from '../types'

export type DateOrder = 'dmy' | 'mdy'

export interface ImportOptions {
  dateOrder: DateOrder
  weightUnit: WeightUnit
  lengthUnit: LengthUnit
}

export interface ParsedWorkout {
  date: string
  title: string
  entries: { exerciseName: string; notes: string; sets: SetLog[] }[]
}

export interface ParsedBodyLog {
  date: string
  weightKg: number | null
  waistIn: number | null
}

export type ParsedImport =
  | { kind: 'workouts'; workouts: ParsedWorkout[]; errors: string[] }
  | { kind: 'body'; bodyLogs: ParsedBodyLog[]; errors: string[] }
  | { kind: 'unknown'; errors: string[] }

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const ALIASES = {
  date: ['date', 'day', 'workout date', 'session date'],
  exercise: ['exercise', 'exercise name', 'movement', 'lift', 'name'],
  weight: ['weight', 'load', 'kg', 'lb', 'lbs', 'weight kg', 'weight lb', 'weight lbs', 'body weight', 'bodyweight'],
  reps: ['reps', 'rep', 'repetitions', 'reps sec', 'time', 'seconds'],
  set: ['set', 'set no', 'set number', 'set #'],
  sets: ['sets', 'log', 'sets x reps', 'performance'],
  session: ['session', 'workout', 'routine', 'day name', 'title'],
  notes: ['notes', 'note', 'comment', 'comments'],
  waist: ['waist', 'waist in', 'waist cm', 'waist inches'],
  drop: ['drop', 'drop set', 'dropset'],
}

type Field = keyof typeof ALIASES

function findColumns(header: string[]) {
  const cols: Partial<Record<Field, number>> = {}
  const units: Partial<Record<'weight' | 'waist', string>> = {}
  header.forEach((raw, i) => {
    const h = norm(raw)
    for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
      if (cols[field] != null) continue
      if (names.includes(h) || names.includes(h.replace(/ (kg|lb|lbs|in|cm)$/, ''))) {
        cols[field] = i
        if (field === 'weight' || field === 'waist') units[field] = h
        break
      }
    }
  })
  // "Set 1", "Set 2"… wide format
  const setCols = header.map((h, i) => (/^set\s*\d+$/i.test(h.trim()) ? i : -1)).filter((i) => i >= 0)
  return { cols, units, setCols }
}

/** Accepts ISO dates, d/m/y or m/d/y (with / . or -), 2-digit years and Excel serial numbers. */
export function parseDate(raw: string, order: DateOrder): string | null {
  const t = raw.trim()
  if (!t) return null
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let a = +m[1]
    let b = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    // Unambiguous cases override the chosen order.
    if (a > 12 && b <= 12) return valid(y, b, a)
    if (b > 12 && a <= 12) return valid(y, a, b)
    return order === 'dmy' ? valid(y, b, a) : valid(y, a, b)
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86_400_000)
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : toISODate(d)
}

function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return null
  return toISODate(dt)
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null
  const t = v.trim().replace(',', '.').replace(/[^\d.\-]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "60x10, 62.5x8; 40*12" → sets. A bare number is treated as reps with no weight. */
export function parseSetNotation(text: string, unit: WeightUnit): SetLog[] {
  return text
    .split(/[,;|/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      const drop = /drop|\(d\)|\bd$/i.test(p)
      const m = p.replace(/,/g, '.').match(/(-?\d+(?:\.\d+)?)\s*(?:kg|lbs?|)?\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?/i)
      if (m) {
        const w = toKg(Number(m[1]), unit)
        // "60x10x3" = 3 sets of 10
        const repeat = m[3] ? Math.min(20, Number(m[3])) : 1
        return Array.from({ length: repeat }, () => ({ weight: w, reps: Number(m[2]), done: true, ...(drop ? { drop } : {}) }))
      }
      const r = num(p)
      return r != null ? [{ weight: 0, reps: r, done: true }] : []
    })
}

export function parseImportCsv(text: string, opts: ImportOptions): ParsedImport {
  const rows = parseCSV(text)
  if (rows.length < 2) return { kind: 'unknown', errors: ['The file has no data rows.'] }
  const [header, ...data] = rows
  const { cols, units, setCols } = findColumns(header)
  const errors: string[] = []

  if (cols.date == null) return { kind: 'unknown', errors: ['Could not find a "Date" column.'] }

  const weightUnit: WeightUnit = units.weight?.includes('lb') ? 'lb' : units.weight?.includes('kg') ? 'kg' : opts.weightUnit
  const cell = (r: string[], f: Field) => (cols[f] != null ? (r[cols[f]!] ?? '').trim() : '')

  // Body measurements file: date + weight/waist, no exercise column.
  if (cols.exercise == null) {
    if (cols.weight == null && cols.waist == null) {
      return { kind: 'unknown', errors: ['Need an "Exercise" column (workout logs) or "Weight"/"Waist" columns (body logs).'] }
    }
    const lengthUnit: LengthUnit = units.waist?.includes('cm') ? 'cm' : units.waist?.includes('in') ? 'in' : opts.lengthUnit
    const logs = new Map<string, ParsedBodyLog>()
    data.forEach((r, i) => {
      const date = parseDate(cell(r, 'date'), opts.dateOrder)
      if (!date) return errors.push(`Row ${i + 2}: unreadable date "${cell(r, 'date')}"`)
      const w = num(cell(r, 'weight'))
      const waist = num(cell(r, 'waist'))
      if (w == null && waist == null) return
      logs.set(date, {
        date,
        weightKg: w != null ? toKg(w, weightUnit) : logs.get(date)?.weightKg ?? null,
        waistIn: waist != null ? toIn(waist, lengthUnit) : logs.get(date)?.waistIn ?? null,
      })
    })
    return { kind: 'body', bodyLogs: [...logs.values()].sort((a, b) => a.date.localeCompare(b.date)), errors }
  }

  const workouts = new Map<string, ParsedWorkout>()
  let lastDate = ''
  let lastExercise = ''
  data.forEach((r, i) => {
    const rowNo = i + 2
    // Excel logs often leave date/exercise blank on continuation rows.
    const rawDate = cell(r, 'date')
    const date = rawDate ? parseDate(rawDate, opts.dateOrder) : lastDate
    if (!date) return errors.push(`Row ${rowNo}: unreadable date "${rawDate}"`)
    lastDate = date
    const name = cell(r, 'exercise') || lastExercise
    if (!name) return errors.push(`Row ${rowNo}: missing exercise name`)
    lastExercise = name

    let sets: SetLog[] = []
    const w = num(cell(r, 'weight'))
    const reps = num(cell(r, 'reps'))
    const setsCell = cell(r, 'sets')
    const isDrop = /^(y|yes|true|1|x)$/i.test(cell(r, 'drop'))

    if (setsCell && /[x×*]/i.test(setsCell)) sets = parseSetNotation(setsCell, weightUnit)
    else if (reps != null) {
      const repeat = setsCell && num(setsCell) != null && cols.set == null ? Math.max(1, Math.min(20, num(setsCell)!)) : 1
      sets = Array.from({ length: repeat }, () => ({
        weight: toKg(w ?? 0, weightUnit),
        reps,
        done: true,
        ...(isDrop ? { drop: true } : {}),
      }))
    }
    for (const c of setCols) if (r[c]?.trim()) sets.push(...parseSetNotation(r[c], weightUnit))

    if (!sets.length) return errors.push(`Row ${rowNo}: no weight × reps found`)

    const title = cell(r, 'session') || 'Imported workout'
    const key = `${date}|${title}`
    if (!workouts.has(key)) workouts.set(key, { date, title, entries: [] })
    const wk = workouts.get(key)!
    let entry = wk.entries.find((e) => e.exerciseName.toLowerCase() === name.toLowerCase())
    if (!entry) {
      entry = { exerciseName: name, notes: '', sets: [] }
      wk.entries.push(entry)
    }
    entry.sets.push(...sets)
    const note = cell(r, 'notes')
    if (note && !entry.notes.includes(note)) entry.notes = entry.notes ? `${entry.notes}; ${note}` : note
  })

  return {
    kind: 'workouts',
    workouts: [...workouts.values()].sort((a, b) => a.date.localeCompare(b.date)),
    errors,
  }
}

export const CSV_TEMPLATE = [
  'Date,Session,Exercise,Set,Weight (kg),Reps,Drop,Notes',
  '2026-10-27,Back + Biceps A,Lat pulldown,1,55,12,,',
  '2026-10-27,Back + Biceps A,Lat pulldown,2,55,10,,',
  '2026-10-27,Back + Biceps A,Lat pulldown,3,55,9,,felt strong',
  '2026-10-27,Back + Biceps A,DB hammer curl,1,12,12,,',
  '2026-10-27,Back + Biceps A,DB hammer curl,2,12,10,,',
  '2026-10-27,Back + Biceps A,DB hammer curl,3,8,10,yes,drop set',
].join('\r\n')
