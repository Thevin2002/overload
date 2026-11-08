import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { useRestTimer } from '../components/RestTimer'
import { Badge, Button, Card, EmptyState, Field, IconButton, PageHeader, Sheet, Stepper, TextArea, TextInput, cx } from '../components/ui'
import { Icon } from '../components/Icon'
import { ExercisePicker } from '../components/ExercisePicker'
import { useAutosave } from '../lib/useAutosave'
import { entriesForItem, groupEntries } from '../lib/workout'
import {
  RECOVERY_HINT,
  computeBests,
  historyFor,
  needsRecoveryCheck,
  sessionPRs,
  suggestNext,
  type Bests,
  type ExerciseSession,
  type PRKind,
} from '../lib/progression'
import { fmtNum, fmtWeight, kgTo, round, toKg } from '../lib/units'
import { formatDate, formatDuration, formatLongDate } from '../lib/dates'
import { summarizeWorkout } from '../lib/stats'
import { newId } from '../lib/id'
import type { Exercise, SetLog, Settings, Workout, WorkoutEntry } from '../types'

export function LogPage() {
  const { id } = useParams()
  const data = useData()
  const { workouts, allWorkouts, saveWorkout, deleteWorkout, exMap, settings, backend, saveHabit, activePlan, ensureArchive } = data
  const { confirm, toast } = useFeedback()
  const timer = useRestTimer()
  const navigate = useNavigate()

  const fromCtx = workouts.find((w) => w.id === id)
  const [w, setW] = useState<Workout | null>(null)
  const [notFound, setNotFound] = useState(false)
  if (!w && fromCtx) setW(fromCtx)

  useEffect(() => {
    ensureArchive() // all-time history for PRs
    if (fromCtx || !id) return
    backend.get<Workout>('workouts', id).then((d) => (d ? setW((cur) => cur ?? d) : setNotFound(true)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const autosave = useAutosave(w, saveWorkout, 400)
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; index: number } | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // History & bests per exercise (excluding this workout)
  const histories = useMemo(() => {
    const map = new Map<string, { history: ExerciseSession[]; bests: Bests }>()
    if (!w) return map
    for (const e of w.entries) {
      if (map.has(e.exerciseId)) continue
      const history = historyFor(allWorkouts, e.exerciseId, w.id)
      map.set(e.exerciseId, { history, bests: computeBests(history) })
    }
    return map
  }, [w?.entries.map((e) => e.exerciseId).join(), allWorkouts, w?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!w) {
    return (
      <>
        <PageHeader title="Workout" back={() => navigate('/')} />
        <EmptyState icon="dumbbell" title={notFound ? 'Workout not found' : 'Loading…'} />
      </>
    )
  }

  const update = (fn: (w: Workout) => Workout) => setW((cur) => (cur ? fn(cur) : cur))
  const setEntry = (index: number, entry: WorkoutEntry) => update((cur) => ({ ...cur, entries: cur.entries.map((e, i) => (i === index ? entry : e)) }))
  const removeEntry = (index: number) => update((cur) => ({ ...cur, entries: cur.entries.filter((_, i) => i !== index) }))

  const onSetCompleted = (index: number, setIndex: number) => {
    if (!settings.autoStartRest) return
    const e = w.entries[index]
    const nextSet = e.sets[setIndex + 1]
    if (nextSet?.drop) return // go straight into the drop set
    const group = e.groupId ? w.entries.filter((x) => x.groupId === e.groupId) : null
    if (group && group[group.length - 1].id !== e.id) return // rest after the last exercise of the round
    const sec = e.restSec ?? (group ? settings.supersetRestSec : settings.restSec)
    timer.start(sec, group ? 'Rest after round' : `Rest · ${exMap.get(e.exerciseId)?.name ?? ''}`)
  }

  const finish = () => {
    const done = { ...w, finishedAt: w.finishedAt ?? Date.now() }
    autosave.cancel()
    setW(done)
    saveWorkout(done)
    if (summarizeWorkout(done).sets > 0) saveHabit(done.date, { workoutDone: true })
    timer.stop()
    setSummaryOpen(true)
  }

  const blocks = groupEntries(w.entries)
  const summary = summarizeWorkout(w)
  const hasAbs = w.entries.some((e) => e.isAbs)

  return (
    <>
      <PageHeader
        title={w.title || 'Workout'}
        subtitle={
          <>
            {formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {summary.sets} sets
            {!w.finishedAt && (
              <>
                {' · '}
                <Elapsed since={w.startedAt} />
              </>
            )}
          </>
        }
        back={() => navigate(-1)}
        right={
          <>
            <IconButton icon="settings" label="Workout details" onClick={() => setDetailsOpen(true)} />
            <Button size="sm" onClick={finish}>
              {w.finishedAt ? 'Done' : 'Finish'}
            </Button>
          </>
        }
      />

      {w.entries.length === 0 && (
        <EmptyState icon="dumbbell" title="Empty workout">
          Add exercises below to start logging.
        </EmptyState>
      )}

      <div className="space-y-3">
        {blocks.map((b) =>
          b.indexes.length > 1 ? (
            <SupersetBlock
              key={b.key}
              entries={b.indexes.map((i) => w.entries[i])}
              exMap={exMap}
              settings={settings}
              histories={histories}
              onChange={(k, entry) => setEntry(b.indexes[k], entry)}
              onCompleted={(k, s) => onSetCompleted(b.indexes[k], s)}
              onSwap={(k) => setPicker({ mode: 'swap', index: b.indexes[k] })}
              onRemove={async () => {
                if (await confirm({ title: 'Remove this superset from the workout?', confirmLabel: 'Remove', danger: true }))
                  update((cur) => ({ ...cur, entries: cur.entries.filter((_, i) => !b.indexes.includes(i)) }))
              }}
            />
          ) : (
            <ExerciseBlock
              key={b.key}
              entry={w.entries[b.indexes[0]]}
              exercise={exMap.get(w.entries[b.indexes[0]].exerciseId)}
              settings={settings}
              info={histories.get(w.entries[b.indexes[0]].exerciseId)}
              onChange={(entry) => setEntry(b.indexes[0], entry)}
              onCompleted={(s) => onSetCompleted(b.indexes[0], s)}
              onSwap={() => setPicker({ mode: 'swap', index: b.indexes[0] })}
              onRemove={async () => {
                if (await confirm({ title: `Remove ${exMap.get(w.entries[b.indexes[0]].exerciseId)?.name ?? 'exercise'}?`, confirmLabel: 'Remove', danger: true }))
                  removeEntry(b.indexes[0])
              }}
            />
          ),
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" icon="plus" onClick={() => setPicker({ mode: 'add' })}>
          Exercise
        </Button>
        {!hasAbs && activePlan && activePlan.absRoutine.length > 0 ? (
          <Button
            variant="secondary"
            icon="flame"
            onClick={() =>
              update((cur) => ({
                ...cur,
                entries: [...cur.entries, ...activePlan.absRoutine.flatMap((it) => entriesForItem(it, allWorkouts, stepKgOf(settings), true))],
              }))
            }
          >
            Add abs
          </Button>
        ) : (
          <Button variant="secondary" icon="check" onClick={finish}>
            Finish
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <Field label="Workout notes">
          <TextArea rows={2} value={w.notes} placeholder="How did it feel?" onChange={(e) => update((cur) => ({ ...cur, notes: e.target.value }))} />
        </Field>
      </Card>

      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        preferMuscle={picker?.mode === 'swap' ? exMap.get(w.entries[picker.index]?.exerciseId)?.muscle : undefined}
        title={picker?.mode === 'swap' ? 'Swap for today' : 'Add exercise'}
        onPick={(ex) => {
          if (picker?.mode === 'swap') {
            const e = w.entries[picker.index]
            setEntry(picker.index, { ...e, exerciseId: ex.id, sets: e.sets.map((s) => ({ ...s, weight: s.done ? s.weight : null })) })
          } else {
            update((cur) => ({
              ...cur,
              entries: [
                ...cur.entries,
                { id: newId(), exerciseId: ex.id, notes: '', target: null, sets: Array.from({ length: 3 }, () => ({ weight: null, reps: null, done: false })) },
              ],
            }))
          }
          setPicker(null)
        }}
      />

      <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Workout details">
        <div className="space-y-4">
          <Field label="Title">
            <TextInput value={w.title} onChange={(e) => update((cur) => ({ ...cur, title: e.target.value }))} />
          </Field>
          <Field label="Date" hint="Change this to log a past workout">
            <TextInput type="date" value={w.date} onChange={(e) => e.target.value && update((cur) => ({ ...cur, date: e.target.value }))} />
          </Field>
          {w.finishedAt && (
            <Button variant="secondary" block onClick={() => update((cur) => ({ ...cur, finishedAt: null }))}>
              Mark as in progress
            </Button>
          )}
          <Button
            variant="ghost"
            icon="trash"
            block
            className="!text-red-600"
            onClick={async () => {
              const ok = await confirm({ title: 'Delete this workout?', message: 'All logged sets in it will be removed. This can’t be undone.', confirmLabel: 'Delete', danger: true })
              if (!ok) return
              autosave.cancel()
              deleteWorkout(w.id)
              timer.stop()
              toast('Workout deleted')
              navigate('/', { replace: true })
            }}
          >
            Delete workout
          </Button>
        </div>
      </Sheet>

      <SummarySheet
        open={summaryOpen}
        workout={w}
        histories={histories}
        exMap={exMap}
        settings={settings}
        onClose={() => {
          setSummaryOpen(false)
          navigate('/', { replace: true })
        }}
      />
    </>
  )
}

function stepKgOf(s: Settings) {
  return s.weightUnit === 'kg' ? s.stepKg : toKg(s.stepLb, 'lb')
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return <>{formatDuration(now - since)}</>
}

// ---------------------------------------------------------------------------

interface BlockCommon {
  settings: Settings
}

function ExerciseBlock({
  entry,
  exercise,
  settings,
  info,
  onChange,
  onCompleted,
  onSwap,
  onRemove,
}: BlockCommon & {
  entry: WorkoutEntry
  exercise?: Exercise
  info?: { history: ExerciseSession[]; bests: Bests }
  onChange: (e: WorkoutEntry) => void
  onCompleted: (setIndex: number) => void
  onSwap: () => void
  onRemove: () => void
}) {
  const [notesOpen, setNotesOpen] = useState(!!entry.notes)
  const history = info?.history ?? []
  const last = history[0]
  const target = entry.target
  const sug = target ? suggestNext(target, history, stepKgOf(settings)) : null
  const prs = info ? sessionPRs(entry.sets, info.bests) : null
  const recovery = needsRecoveryCheck(history)
  const doneCount = entry.sets.filter((s) => s.done && !s.drop).length
  const isSec = target?.repUnit === 'sec'

  const applySuggestion = () => {
    if (!sug || sug.kind === 'start') return
    onChange({ ...entry, sets: entry.sets.map((s) => (s.done || s.drop ? s : { ...s, weight: sug.weightKg })) })
  }

  return (
    <Card className={cx('!p-0', entry.isAbs && 'ring-violet-200 dark:ring-violet-500/30')}>
      <div className="flex items-start gap-1 p-3 pb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[17px] font-semibold">{exercise?.name ?? 'Unknown exercise'}</h3>
            {entry.isAbs && <Badge tone="violet">Abs</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
            {target && (
              <span className="tabular-nums">
                {target.sets} × {target.repMin}–{target.repMax}
                {isSec ? 's' : ''}
                {target.perSide ? '/side' : ''}
              </span>
            )}
            {exercise && <span>{exercise.muscle}</span>}
            <span className="tabular-nums">
              {doneCount}/{entry.sets.filter((s) => !s.drop).length} done
            </span>
          </div>
        </div>
        <IconButton icon="swap" label="Swap exercise for today" onClick={onSwap} size={40} />
        <IconButton icon="trash" label="Remove exercise" onClick={onRemove} size={40} />
      </div>

      <div className="space-y-1.5 px-3">
        {(entry.cue || exercise?.notes) && <p className="text-xs text-ink-500 italic">{entry.cue || exercise?.notes}</p>}
        {last && (
          <p className="text-sm text-ink-600 dark:text-ink-300">
            <span className="text-ink-500">Last ({formatDate(last.date)}): </span>
            <span className="tabular-nums">{lastLine(last.sets, settings, isSec)}</span>
          </p>
        )}
        {sug && (
          <div
            className={cx(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
              sug.kind === 'increase' ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
            )}
          >
            <Icon name={sug.kind === 'increase' ? 'up' : 'info'} size={16} className="shrink-0" />
            <span className="flex-1">{suggestionText(sug, settings, isSec)}</span>
            {sug.kind === 'increase' && entry.sets.some((s) => !s.done && !s.drop && s.weight !== sug.weightKg) && (
              <button type="button" className="h-8 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-white" onClick={applySuggestion}>
                Apply
              </button>
            )}
          </div>
        )}
        {recovery && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{RECOVERY_HINT}</p>}
        {prs?.volume && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            <Icon name="trophy" size={16} /> Volume PR
          </p>
        )}
      </div>

      <div className="mt-2 px-2.5">
        <SetHeader isSec={isSec} unit={settings.weightUnit} />
        {entry.sets.map((s, i) => (
          <SetRow
            key={i}
            label={s.drop ? 'D' : String(entry.sets.slice(0, i + 1).filter((x) => !x.drop).length)}
            set={s}
            prs={prs?.sets[i] ?? []}
            settings={settings}
            isSec={isSec}
            placeholder={placeholderFor(entry, i, last, sug)}
            onChange={(ns, justCompleted) => {
              onChange({ ...entry, sets: entry.sets.map((x, k) => (k === i ? ns : x)) })
              if (justCompleted) onCompleted(i)
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1 p-2">
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange({ ...entry, sets: addSet(entry.sets, false) })}>
          Set
        </Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange({ ...entry, sets: addSet(entry.sets, true) })}>
          Drop set
        </Button>
        {entry.sets.length > 1 && (
          <Button size="sm" variant="ghost" icon="minus" onClick={() => onChange({ ...entry, sets: entry.sets.slice(0, -1) })}>
            Last
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="note" className="ml-auto" onClick={() => setNotesOpen((o) => !o)}>
          Notes
        </Button>
      </div>
      {notesOpen && (
        <div className="px-3 pb-3">
          <TextArea rows={2} value={entry.notes} placeholder="Notes for this exercise" onChange={(e) => onChange({ ...entry, notes: e.target.value })} />
        </div>
      )}
    </Card>
  )
}

function SupersetBlock({
  entries,
  exMap,
  settings,
  histories,
  onChange,
  onCompleted,
  onSwap,
  onRemove,
}: BlockCommon & {
  entries: WorkoutEntry[]
  exMap: Map<string, Exercise>
  histories: Map<string, { history: ExerciseSession[]; bests: Bests }>
  onChange: (k: number, e: WorkoutEntry) => void
  onCompleted: (k: number, setIndex: number) => void
  onSwap: (k: number) => void
  onRemove: () => void
}) {
  const rounds = Math.max(...entries.map((e) => e.sets.length))
  const target = entries[0].target
  const letters = entries.map((_, k) => String.fromCharCode(65 + k))

  return (
    <Card className="!p-0 ring-amber-200 dark:ring-amber-500/30">
      <div className="flex items-start gap-1 p-3 pb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone="amber">Superset</Badge>
            {target && (
              <span className="text-sm text-ink-500 tabular-nums">
                {target.sets} rounds · {target.repMin}–{target.repMax}
              </span>
            )}
          </div>
          {entries.map((e, k) => {
            const h = histories.get(e.exerciseId)?.history[0]
            const sug = e.target ? suggestNext(e.target, histories.get(e.exerciseId)?.history ?? [], stepKgOf(settings)) : null
            return (
              <div key={e.id} className="mt-1.5 flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    <span className="text-amber-600 dark:text-amber-400">{letters[k]}.</span> {exMap.get(e.exerciseId)?.name ?? 'Unknown exercise'}
                  </div>
                  {h && <div className="text-xs text-ink-500 tabular-nums">Last: {lastLine(h.sets, settings, false)}</div>}
                  {sug && sug.kind !== 'start' && <div className="text-xs text-brand-600 dark:text-brand-400">{suggestionText(sug, settings, false)}</div>}
                </div>
                <IconButton icon="swap" label="Swap exercise for today" onClick={() => onSwap(k)} size={36} />
              </div>
            )
          })}
        </div>
        <IconButton icon="trash" label="Remove superset" onClick={onRemove} size={36} />
      </div>
      <div className="mt-1 px-2.5 pb-2">
        {Array.from({ length: rounds }, (_, r) => (
          <div key={r} className="border-t border-ink-100 pt-1.5 pb-1 first:border-0 dark:border-ink-800">
            <div className="text-xs font-medium text-ink-500">Round {r + 1}</div>
            {entries.map((e, k) => {
              const s = e.sets[r]
              if (!s) return null
              const info = histories.get(e.exerciseId)
              const prs = info ? sessionPRs(e.sets, info.bests).sets[r] : []
              const sug = e.target ? suggestNext(e.target, info?.history ?? [], stepKgOf(settings)) : null
              return (
                <SetRow
                  key={k}
                  label={letters[k]}
                  set={s}
                  prs={prs}
                  settings={settings}
                  isSec={false}
                  placeholder={placeholderFor(e, r, info?.history[0], sug)}
                  onChange={(ns, justCompleted) => {
                    onChange(k, { ...e, sets: e.sets.map((x, i) => (i === r ? ns : x)) })
                    if (justCompleted) onCompleted(k, r)
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-1 p-2 pt-0">
        <Button size="sm" variant="ghost" icon="plus" onClick={() => entries.forEach((e, k) => onChange(k, { ...e, sets: addSet(e.sets, false) }))}>
          Round
        </Button>
        {rounds > 1 && (
          <Button size="sm" variant="ghost" icon="minus" onClick={() => entries.forEach((e, k) => onChange(k, { ...e, sets: e.sets.slice(0, -1) }))}>
            Last round
          </Button>
        )}
      </div>
    </Card>
  )
}

function SetHeader({ isSec, unit }: { isSec: boolean; unit: string }) {
  return (
    <div className="grid grid-cols-[22px_1fr_1fr_44px] gap-1.5 px-0.5 pb-1 text-[11px] font-medium tracking-wide text-ink-400 uppercase">
      <span>Set</span>
      <span className="text-center">{unit}</span>
      <span className="text-center">{isSec ? 'Seconds' : 'Reps'}</span>
      <span />
    </div>
  )
}

function SetRow({
  label,
  set,
  prs,
  settings,
  isSec,
  placeholder,
  onChange,
}: {
  label: string
  set: SetLog
  prs: PRKind[]
  settings: Settings
  isSec: boolean
  placeholder: { weight: number | null; reps: number | null }
  onChange: (s: SetLog, justCompleted: boolean) => void
}) {
  const unit = settings.weightUnit
  const wStep = unit === 'kg' ? settings.stepKg : settings.stepLb
  const toDisplay = (kg: number | null) => (kg == null ? null : round(kgTo(kg, unit), 2))

  const toggleDone = () => {
    if (set.done) return onChange({ ...set, done: false }, false)
    const weight = set.weight ?? placeholder.weight ?? 0
    const reps = set.reps ?? placeholder.reps
    if (reps == null || reps <= 0) return // nothing to log yet
    onChange({ ...set, weight, reps, done: true }, true)
  }

  return (
    <div className={cx('grid grid-cols-[22px_1fr_1fr_44px] items-center gap-1.5 py-1', set.done && 'opacity-95')}>
      <div className="relative flex flex-col items-center">
        <span className={cx('text-sm font-semibold tabular-nums', set.drop ? 'text-red-500' : 'text-ink-500')}>{label}</span>
        {prs.length > 0 && (
          <span title={`PR: ${prs.join(', ')}`} className="text-amber-500">
            <Icon name="trophy" size={14} />
          </span>
        )}
      </div>
      <Stepper
        label="weight"
        step={wStep}
        value={toDisplay(set.weight)}
        placeholder={placeholder.weight != null ? fmtNum(kgTo(placeholder.weight, unit), 1) : '0'}
        onChange={(v) => onChange({ ...set, weight: v == null ? null : toKg(v, unit) }, false)}
      />
      <Stepper
        label={isSec ? 'seconds' : 'reps'}
        step={isSec ? 5 : 1}
        decimal={false}
        value={set.reps}
        placeholder={placeholder.reps != null ? String(placeholder.reps) : '–'}
        onChange={(v) => onChange({ ...set, reps: v }, false)}
      />
      <button
        type="button"
        onClick={toggleDone}
        aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
        aria-pressed={set.done}
        className={cx(
          'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
          set.done
            ? prs.length
              ? 'bg-amber-500 text-white'
              : 'bg-brand-500 text-white'
            : 'bg-ink-100 text-ink-400 active:bg-ink-200 dark:bg-ink-800 dark:active:bg-ink-700',
        )}
      >
        <Icon name="check" size={22} strokeWidth={2.6} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function addSet(sets: SetLog[], drop: boolean): SetLog[] {
  const last = [...sets].reverse().find((s) => !s.drop) ?? sets[sets.length - 1]
  const lastAny = sets[sets.length - 1]
  if (drop) return [...sets, { weight: lastAny?.weight != null ? Math.round(lastAny.weight * 0.7 * 4) / 4 : null, reps: null, done: false, drop: true }]
  // insert a normal set before any trailing drop sets
  const firstTrailingDrop = sets.length - [...sets].reverse().findIndex((s) => !s.drop)
  const idx = sets.every((s) => s.drop) ? 0 : firstTrailingDrop
  const out = [...sets]
  out.splice(idx, 0, { weight: last?.weight ?? null, reps: null, done: false })
  return out
}

function placeholderFor(entry: WorkoutEntry, i: number, last: ExerciseSession | undefined, sug: ReturnType<typeof suggestNext> | null) {
  const s = entry.sets[i]
  const lastSets = last?.sets.filter((x) => x.done && !!x.drop === !!s.drop) ?? []
  const n = entry.sets.slice(0, i).filter((x) => !!x.drop === !!s.drop).length
  const prevInSession = entry.sets.slice(0, i).reverse().find((x) => x.done && !!x.drop === !!s.drop)
  const lastSet = lastSets[n] ?? lastSets[lastSets.length - 1]
  const weight = s.drop ? prevInSession?.weight ?? lastSet?.weight ?? null : sug && sug.kind !== 'start' ? sug.weightKg : lastSet?.weight ?? prevInSession?.weight ?? null
  const reps = s.drop
    ? lastSet?.reps ?? null
    : sug && sug.kind !== 'start'
      ? sug.reps
      : lastSet?.reps ?? prevInSession?.reps ?? entry.target?.repMin ?? null
  return { weight, reps }
}

function lastLine(sets: SetLog[], settings: Settings, isSec: boolean): string {
  return sets
    .filter((s) => s.done)
    .map((s) => `${s.drop ? 'D ' : ''}${(s.weight ?? 0) > 0 ? `${fmtWeight(s.weight, settings.weightUnit, false)}×` : ''}${s.reps}${isSec ? 's' : ''}`)
    .join(' · ')
}

function suggestionText(sug: ReturnType<typeof suggestNext>, settings: Settings, isSec: boolean): string {
  if (sug.kind === 'start') return sug.message
  const w = fmtWeight(sug.weightKg, settings.weightUnit)
  const unit = isSec ? 's' : ' reps'
  if (sug.kind === 'increase') return `Go up: ${w} × ${sug.reps}${unit}+`
  return sug.weightKg > 0 ? `Stay at ${w} — aim for ${sug.reps}+${unit}` : `Aim for ${sug.reps}+${unit} each set`
}

// ---------------------------------------------------------------------------

function SummarySheet({
  open,
  workout,
  histories,
  exMap,
  settings,
  onClose,
}: {
  open: boolean
  workout: Workout
  histories: Map<string, { history: ExerciseSession[]; bests: Bests }>
  exMap: Map<string, Exercise>
  settings: Settings
  onClose: () => void
}) {
  const s = summarizeWorkout(workout)
  const prList: string[] = []
  const hints: string[] = []
  for (const e of workout.entries) {
    const info = histories.get(e.exerciseId)
    if (!info) continue
    const name = exMap.get(e.exerciseId)?.name ?? 'Exercise'
    const p = sessionPRs(e.sets, info.bests)
    const kinds = new Set(p.sets.flat())
    if (kinds.has('weight')) prList.push(`${name}: heaviest weight`)
    else if (kinds.has('e1rm')) prList.push(`${name}: best estimated 1RM`)
    else if (kinds.has('reps')) prList.push(`${name}: most reps at a weight`)
    if (p.volume) prList.push(`${name}: best volume`)
    if (e.sets.some((x) => x.done) && needsRecoveryCheck([{ date: workout.date, workoutId: workout.id, sets: e.sets }, ...info.history])) hints.push(name)
  }
  const duration = (workout.finishedAt ?? Date.now()) - workout.startedAt

  return (
    <Sheet open={open} onClose={onClose} title="Workout complete" footer={<Button block onClick={onClose}>Done</Button>}>
      <p className="text-ink-500">{formatLongDate(workout.date)}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <SummaryStat label="Sets" value={String(s.sets)} />
        <SummaryStat label="Volume" value={`${fmtNum(kgTo(s.volume, settings.weightUnit), 0)}`} sub={settings.weightUnit} />
        <SummaryStat label="Time" value={duration < 6 * 3600_000 ? formatDuration(duration) : '–'} />
      </div>
      {prList.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
            <Icon name="trophy" size={18} /> {prList.length} personal record{prList.length > 1 ? 's' : ''}
          </div>
          <ul className="space-y-0.5 text-sm text-amber-800 dark:text-amber-200">
            {prList.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-500">Solid work. Consistency is what drives progress.</p>
      )}
      {hints.length > 0 && (
        <p className="mt-3 rounded-2xl bg-ink-100 p-3 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          Reps dipped two sessions running on {hints.join(', ')}. Check food, sleep and recovery.
        </p>
      )}
    </Sheet>
  )
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-ink-100 p-2 dark:bg-ink-800">
      <div className="text-lg font-semibold tabular-nums">
        {value}
        {sub && <span className="ml-0.5 text-xs font-normal text-ink-500">{sub}</span>}
      </div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  )
}
