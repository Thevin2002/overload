import { useMemo, useState } from 'react'
import { Button, Field, Select, Sheet, TextArea, TextInput, cx } from './ui'
import { Icon } from './Icon'
import { useData } from '../data/DataContext'
import { EQUIPMENT, MUSCLE_GROUPS, type Exercise } from '../types'
import { newId } from '../lib/id'

export function filterExercises(list: Exercise[], q: string, muscle: string | null) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter(
    (e) =>
      (!muscle || e.muscle === muscle) &&
      terms.every((t) => `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(t)),
  )
}

/** Bottom sheet to pick (or quickly create) an exercise. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Choose exercise',
  preferMuscle,
}: {
  open: boolean
  onClose: () => void
  onPick: (ex: Exercise) => void
  title?: string
  preferMuscle?: string
}) {
  const { exercises } = useData()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [creating, setCreating] = useState<Exercise | null>(null)

  const effectiveMuscle = muscle === '__all' ? null : muscle ?? preferMuscle ?? null
  const results = useMemo(() => filterExercises(exercises, q, effectiveMuscle), [exercises, q, effectiveMuscle])
  const muscles = useMemo(() => [...new Set(exercises.map((e) => e.muscle))].sort(), [exercises])

  const close = () => {
    setQ('')
    setMuscle(null)
    onClose()
  }

  return (
    <>
      <Sheet open={open && !creating} onClose={close} title={title}>
        <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2 dark:bg-ink-850">
          <TextInput autoFocus placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <Chip active={!effectiveMuscle} onClick={() => setMuscle('__all')}>
              All
            </Chip>
            {muscles.map((m) => (
              <Chip key={m} active={effectiveMuscle === m} onClick={() => setMuscle(m)}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  // The parent decides whether to close (a superset picks twice in a row).
                  setQ('')
                  setMuscle(null)
                  onPick(e)
                }}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-ink-50 dark:active:bg-ink-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.name}</div>
                  <div className="truncate text-xs text-ink-500">
                    {e.muscle} · {e.equipment}
                  </div>
                </div>
                <Icon name="chevronRight" size={18} className="text-ink-400" />
              </button>
            </li>
          ))}
        </ul>
        {results.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No matches.</p>}
        <Button
          variant="secondary"
          icon="plus"
          block
          className="mt-3"
          onClick={() =>
            setCreating({ id: newId(), name: q.trim(), muscle: effectiveMuscle ?? 'Other', equipment: 'Other', notes: '', createdAt: Date.now() })
          }
        >
          {q.trim() ? `Create “${q.trim()}”` : 'New exercise'}
        </Button>
      </Sheet>
      <ExerciseForm
        exercise={creating}
        onClose={() => setCreating(null)}
        onSaved={(ex) => {
          setCreating(null)
          setQ('')
          setMuscle(null)
          onPick(ex)
        }}
      />
    </>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-8 shrink-0 rounded-full px-3 text-sm whitespace-nowrap transition-colors',
        active ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
      )}
    >
      {children}
    </button>
  )
}

/** Create / edit sheet for an exercise. */
export function ExerciseForm({ exercise, onClose, onSaved }: { exercise: Exercise | null; onClose: () => void; onSaved?: (ex: Exercise) => void }) {
  const { saveExercise } = useData()
  const [draft, setDraft] = useState<Exercise | null>(exercise)
  const [lastId, setLastId] = useState<string | null>(null)
  if (exercise && exercise.id !== lastId) {
    setLastId(exercise.id)
    setDraft(exercise)
  }
  if (!exercise && lastId) setLastId(null)

  const set = (patch: Partial<Exercise>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const valid = !!draft?.name.trim()

  return (
    <Sheet
      open={!!exercise}
      onClose={onClose}
      title={exercise?.name ? 'Edit exercise' : 'New exercise'}
      footer={
        <Button
          block
          disabled={!valid}
          onClick={() => {
            if (!draft) return
            const ex = { ...draft, name: draft.name.trim() }
            saveExercise(ex)
            onSaved?.(ex)
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      {draft && (
        <div className="space-y-4">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cable crunch" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Muscle group">
              <Select value={draft.muscle} onChange={(e) => set({ muscle: e.target.value })}>
                {[...new Set([...MUSCLE_GROUPS, draft.muscle])].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment">
              <Select value={draft.equipment} onChange={(e) => set({ equipment: e.target.value })}>
                {[...new Set([...EQUIPMENT, draft.equipment])].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes" hint="Cues, seat settings, grip…">
            <TextArea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} />
          </Field>
        </div>
      )}
    </Sheet>
  )
}
