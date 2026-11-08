import { describe, expect, it } from 'vitest'
import {
  computeBests,
  e1rm,
  historyFor,
  needsRecoveryCheck,
  sessionPRs,
  setPRs,
  suggestNext,
  type ExerciseSession,
} from './progression'
import type { SetLog, Workout } from '../types'

const s = (weight: number, reps: number, extra: Partial<SetLog> = {}): SetLog => ({ weight, reps, done: true, ...extra })
const session = (date: string, sets: SetLog[]): ExerciseSession => ({ date, workoutId: date, sets })
const target = { sets: 3, repMin: 8, repMax: 12 }

describe('e1rm', () => {
  it('uses Epley and returns weight for a single', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(0, 10)).toBe(0)
  })
})

describe('suggestNext (double progression)', () => {
  it('asks for a starting weight with no history', () => {
    expect(suggestNext(target, [], 2.5).kind).toBe('start')
  })

  it('increases weight by the step and drops to the bottom of the range when every set hits the top', () => {
    const sug = suggestNext(target, [session('2026-11-01', [s(60, 12), s(60, 12), s(60, 12)])], 2.5)
    expect(sug).toMatchObject({ kind: 'increase', weightKg: 62.5, reps: 8 })
  })

  it('respects a custom step', () => {
    const sug = suggestNext(target, [session('2026-11-01', [s(60, 12), s(60, 13), s(60, 12)])], 5)
    expect(sug).toMatchObject({ kind: 'increase', weightKg: 65 })
  })

  it('holds the weight when any set is below the top of the range', () => {
    const sug = suggestNext(target, [session('2026-11-01', [s(60, 12), s(60, 11), s(60, 9)])], 2.5)
    expect(sug).toMatchObject({ kind: 'hold', weightKg: 60, reps: 10 })
  })

  it('does not progress if fewer sets than targeted were completed', () => {
    const sug = suggestNext(target, [session('2026-11-01', [s(60, 12), s(60, 12)])], 2.5)
    expect(sug.kind).toBe('hold')
  })

  it('ignores drop sets and unfinished sets', () => {
    const sets = [s(60, 12), s(60, 12), s(60, 12), s(40, 6, { drop: true }), { weight: 60, reps: 3, done: false }]
    expect(suggestNext(target, [session('2026-11-01', sets)], 2.5).kind).toBe('increase')
  })

  it('uses the most recent session only', () => {
    const history = [session('2026-11-03', [s(62.5, 8), s(62.5, 8), s(62.5, 7)]), session('2026-11-01', [s(60, 12), s(60, 12), s(60, 12)])]
    expect(suggestNext(target, history, 2.5)).toMatchObject({ kind: 'hold', weightKg: 62.5, reps: 8 })
  })

  it('caps the rep goal at the top of the range', () => {
    const sug = suggestNext(target, [session('2026-11-01', [s(60, 12), s(60, 12), s(60, 12), s(60, 11)])], 2.5)
    expect(sug).toMatchObject({ kind: 'hold', reps: 12 })
  })

  it('handles bodyweight exercises (weight 0)', () => {
    const sug = suggestNext({ sets: 2, repMin: 12, repMax: 15 }, [session('2026-11-01', [s(0, 15), s(0, 16)])], 2.5)
    expect(sug).toMatchObject({ kind: 'increase', weightKg: 2.5, reps: 12 })
  })
})

describe('needsRecoveryCheck', () => {
  it('flags two consecutive drops in reps at the same weight', () => {
    const h = [
      session('2026-11-05', [s(60, 8), s(60, 7), s(60, 7)]),
      session('2026-11-03', [s(60, 10), s(60, 9), s(60, 9)]),
      session('2026-11-01', [s(60, 11), s(60, 11), s(60, 10)]),
    ]
    expect(needsRecoveryCheck(h)).toBe(true)
  })

  it('does not flag a single drop', () => {
    const h = [
      session('2026-11-05', [s(60, 8), s(60, 8)]),
      session('2026-11-03', [s(60, 11), s(60, 11)]),
      session('2026-11-01', [s(60, 10), s(60, 10)]),
    ]
    expect(needsRecoveryCheck(h)).toBe(false)
  })

  it('does not flag fewer reps after a weight increase', () => {
    const h = [
      session('2026-11-05', [s(62.5, 8), s(62.5, 8)]),
      session('2026-11-03', [s(60, 10), s(60, 10)]),
      session('2026-11-01', [s(60, 12), s(60, 12)]),
    ]
    expect(needsRecoveryCheck(h)).toBe(false)
  })

  it('needs at least three sessions', () => {
    expect(needsRecoveryCheck([session('a', [s(60, 8)]), session('b', [s(60, 10)])])).toBe(false)
  })
})

describe('PRs', () => {
  const history = [session('2026-11-01', [s(60, 10), s(60, 9)]), session('2026-10-28', [s(57.5, 12)])]
  const bests = computeBests(history)

  it('computes bests across history', () => {
    expect(bests.maxWeight).toBe(60)
    expect(bests.sessions).toBe(2)
    expect(bests.maxVolume).toBe(60 * 10 + 60 * 9)
  })

  it('flags a heavier weight as weight + e1rm PR', () => {
    expect(setPRs(s(62.5, 10), bests)).toEqual(expect.arrayContaining(['weight', 'e1rm']))
  })

  it('a heavier set with a lower estimated 1RM is only a weight PR', () => {
    // 62.5×8 ≈ 79.2 e1RM, below the earlier 57.5×12 ≈ 80.5
    expect(setPRs(s(62.5, 8), bests)).toEqual(['weight'])
  })

  it('flags more reps at a previously used weight', () => {
    expect(setPRs(s(60, 11), bests)).toContain('reps')
  })

  it('never flags the very first session, drop sets or unfinished sets', () => {
    expect(setPRs(s(100, 10), computeBests([]))).toEqual([])
    expect(setPRs(s(100, 10, { drop: true }), bests)).toEqual([])
    expect(setPRs({ weight: 100, reps: 10, done: false }, bests)).toEqual([])
  })

  it('flags a session volume PR', () => {
    expect(sessionPRs([s(60, 10), s(60, 10)], bests).volume).toBe(true)
    expect(sessionPRs([s(60, 5)], bests).volume).toBe(false)
  })
})

describe('historyFor', () => {
  const w = (id: string, date: string, sets: SetLog[]): Workout => ({
    id,
    date,
    startedAt: 0,
    finishedAt: 1,
    title: '',
    notes: '',
    entries: [{ id: 'e', exerciseId: 'bench', notes: '', sets }],
  })

  it('returns sessions newest first and excludes the current workout', () => {
    const list = [w('a', '2026-11-01', [s(60, 10)]), w('b', '2026-11-04', [s(62.5, 8)]), w('c', '2026-11-05', [s(65, 5)])]
    const h = historyFor(list, 'bench', 'c')
    expect(h.map((x) => x.workoutId)).toEqual(['b', 'a'])
  })

  it('skips workouts where no set was completed', () => {
    const h = historyFor([w('a', '2026-11-01', [{ weight: 60, reps: null, done: false }])], 'bench')
    expect(h).toEqual([])
  })
})
