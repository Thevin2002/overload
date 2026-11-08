import { describe, expect, it } from 'vitest'
import { exerciseSeries, weeklyMuscleSets } from './stats'
import type { Exercise, Workout } from '../types'

const ex = (id: string, muscle: string): Exercise => ({ id, name: id, muscle, equipment: '', notes: '', createdAt: 0 })
const exMap = new Map([ex('bench', 'Chest'), ex('row', 'Back')].map((e) => [e.id, e]))

const w = (date: string, entries: Workout['entries']): Workout => ({
  id: date,
  date,
  startedAt: 0,
  finishedAt: 1,
  title: '',
  notes: '',
  entries,
})

describe('exerciseSeries', () => {
  it('returns oldest-first points with heaviest, volume and e1rm', () => {
    const list = [
      w('2026-11-04', [{ id: '1', exerciseId: 'bench', notes: '', sets: [{ weight: 62.5, reps: 8, done: true }] }]),
      w('2026-11-01', [{ id: '1', exerciseId: 'bench', notes: '', sets: [{ weight: 60, reps: 10, done: true }, { weight: 60, reps: 9, done: true }] }]),
    ]
    const series = exerciseSeries(list, 'bench')
    expect(series.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-04'])
    expect(series[0]).toMatchObject({ heaviest: 60, volume: 1140, e1rm: 80 })
  })
})

describe('weeklyMuscleSets', () => {
  it('counts working sets per muscle per week (Monday start)', () => {
    const list = [
      w('2026-11-03', [
        { id: '1', exerciseId: 'bench', notes: '', sets: [{ weight: 60, reps: 10, done: true }, { weight: 40, reps: 8, done: true, drop: true }] },
        { id: '2', exerciseId: 'row', notes: '', sets: [{ weight: 50, reps: 10, done: true }, { weight: 50, reps: 10, done: true }] },
      ]),
      w('2026-10-28', [{ id: '1', exerciseId: 'bench', notes: '', sets: [{ weight: 60, reps: 10, done: true }] }]),
    ]
    const { rows, muscles } = weeklyMuscleSets(list, exMap, '2026-11-05', 2, 1)
    expect(muscles).toEqual(['Back', 'Chest'])
    expect(rows).toEqual([
      { week: '2026-10-26', Back: 0, Chest: 1 },
      { week: '2026-11-02', Back: 2, Chest: 1 },
    ])
  })
})
