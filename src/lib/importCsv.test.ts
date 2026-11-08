import { describe, expect, it } from 'vitest'
import { parseCSV, toCSV } from './csv'
import { CSV_TEMPLATE, parseDate, parseImportCsv, parseSetNotation } from './importCsv'

const opts = { dateOrder: 'dmy' as const, weightUnit: 'kg' as const, lengthUnit: 'in' as const }

describe('parseCSV / toCSV', () => {
  it('handles quotes, embedded commas and newlines', () => {
    const rows = parseCSV('a,b\r\n"x, y","he said ""hi"""\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ])
  })

  it('detects semicolon delimiters (European Excel)', () => {
    expect(parseCSV('Date;Exercise;Weight;Reps\n01/11/2026;Bench;60,5;10')).toEqual([
      ['Date', 'Exercise', 'Weight', 'Reps'],
      ['01/11/2026', 'Bench', '60,5', '10'],
    ])
  })

  it('round-trips through toCSV', () => {
    const data = [['a', 'b,c', 'd"e']]
    expect(parseCSV(toCSV(data))).toEqual(data)
  })
})

describe('parseDate', () => {
  it('reads ISO, d/m/y, m/d/y and Excel serials', () => {
    expect(parseDate('2026-11-05', 'dmy')).toBe('2026-11-05')
    expect(parseDate('05/11/2026', 'dmy')).toBe('2026-11-05')
    expect(parseDate('11/05/2026', 'mdy')).toBe('2026-11-05')
    expect(parseDate('25/10/26', 'mdy')).toBe('2026-10-25') // unambiguous overrides order
    expect(parseDate('46331', 'dmy')).toBe('2026-11-05')
    expect(parseDate('nonsense', 'dmy')).toBeNull()
  })
})

describe('parseSetNotation', () => {
  it('parses weight x reps lists and repeats', () => {
    expect(parseSetNotation('60x10, 62.5x8', 'kg')).toEqual([
      { weight: 60, reps: 10, done: true },
      { weight: 62.5, reps: 8, done: true },
    ])
    expect(parseSetNotation('40x12x3', 'kg')).toHaveLength(3)
  })

  it('converts pounds to kg', () => {
    expect(parseSetNotation('100x5', 'lb')[0].weight).toBeCloseTo(45.36, 2)
  })
})

describe('parseImportCsv', () => {
  it('parses the template into one workout with two exercises', () => {
    const res = parseImportCsv(CSV_TEMPLATE, opts)
    expect(res.kind).toBe('workouts')
    if (res.kind !== 'workouts') return
    expect(res.errors).toEqual([])
    expect(res.workouts).toHaveLength(1)
    const [w] = res.workouts
    expect(w.title).toBe('Back + Biceps A')
    expect(w.entries.map((e) => e.exerciseName)).toEqual(['Lat pulldown', 'DB hammer curl'])
    expect(w.entries[1].sets[2]).toMatchObject({ weight: 8, reps: 10, drop: true })
    expect(w.entries[0].notes).toBe('felt strong')
  })

  it('fills blank date/exercise cells from the row above and reads "Sets" notation', () => {
    const csv = 'Date,Exercise,Sets\n03/11/2026,Leg press,100x12; 100x11\n,Leg extension,40x15'
    const res = parseImportCsv(csv, opts)
    if (res.kind !== 'workouts') throw new Error(res.kind)
    expect(res.workouts[0].date).toBe('2026-11-03')
    expect(res.workouts[0].entries).toHaveLength(2)
    expect(res.workouts[0].entries[0].sets).toHaveLength(2)
  })

  it('supports wide "Set 1, Set 2" columns and lb headers', () => {
    const csv = 'Date,Exercise,Set 1,Set 2\n2026-11-01,Curl,50x10,50x9'
    const res = parseImportCsv(csv, { ...opts, weightUnit: 'lb' })
    if (res.kind !== 'workouts') throw new Error(res.kind)
    expect(res.workouts[0].entries[0].sets).toHaveLength(2)
    expect(res.workouts[0].entries[0].sets[0].weight).toBeCloseTo(22.68, 2)
  })

  it('treats a numeric Sets column as a repeat count', () => {
    const csv = 'Date,Exercise,Weight,Reps,Sets\n2026-11-01,Row,50,10,3'
    const res = parseImportCsv(csv, opts)
    if (res.kind !== 'workouts') throw new Error(res.kind)
    expect(res.workouts[0].entries[0].sets).toHaveLength(3)
  })

  it('detects body measurement files', () => {
    const csv = 'Date,Weight (kg),Waist (cm)\n2026-11-01,66,83.82'
    const res = parseImportCsv(csv, opts)
    expect(res.kind).toBe('body')
    if (res.kind !== 'body') return
    expect(res.bodyLogs[0].weightKg).toBe(66)
    expect(res.bodyLogs[0].waistIn).toBeCloseTo(33, 2)
  })

  it('reports rows it cannot read', () => {
    const res = parseImportCsv('Date,Exercise,Weight,Reps\nbad,Row,50,10\n2026-11-01,Row,,', opts)
    expect(res.errors).toHaveLength(2)
  })
})
