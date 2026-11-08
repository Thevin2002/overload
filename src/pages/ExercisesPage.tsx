import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { Button, Card, EmptyState, IconButton, PageHeader, TextInput } from '../components/ui'
import { Chip, ExerciseForm, filterExercises } from '../components/ExercisePicker'
import { newId } from '../lib/id'
import { usagesOf } from '../lib/plan'
import type { Exercise } from '../types'

export function ExercisesPage() {
  const { exercises, plans, deleteExercise } = useData()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)

  const muscles = useMemo(() => [...new Set(exercises.map((e) => e.muscle))].sort(), [exercises])
  const results = useMemo(() => filterExercises(exercises, q, muscle), [exercises, q, muscle])
  const grouped = useMemo(() => {
    const g = new Map<string, Exercise[]>()
    for (const e of results) g.set(e.muscle, [...(g.get(e.muscle) || []), e])
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [results])

  const remove = async (ex: Exercise) => {
    const uses = usagesOf(ex.id, plans)
    const ok = await confirm({
      title: `Delete “${ex.name}”?`,
      message: uses.length ? (
        <>
          It’s used in: <b>{uses.join(', ')}</b>. Those plan entries will show “Unknown exercise” until you swap them. Logged history is kept.
        </>
      ) : (
        'Logged history for this exercise is kept.'
      ),
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      deleteExercise(ex.id)
      setEditing(null)
      toast('Exercise deleted')
    }
  }

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle={`${exercises.length} in your library`}
        back={() => navigate(-1)}
        right={
          <Button size="sm" icon="plus" onClick={() => setEditing({ id: newId(), name: '', muscle: muscle ?? 'Chest', equipment: 'Dumbbell', notes: '', createdAt: Date.now() })}>
            New
          </Button>
        }
      />
      <TextInput type="search" placeholder="Search name, muscle, equipment" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-2 mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={!muscle} onClick={() => setMuscle(null)}>
          All
        </Chip>
        {muscles.map((m) => (
          <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
            {m}
          </Chip>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState icon="dumbbell" title={exercises.length ? 'No matches' : 'Library is empty'}>
          {exercises.length ? 'Try a different search.' : 'Add your first exercise with “New”.'}
        </EmptyState>
      ) : (
        grouped.map(([m, list]) => (
          <section key={m} className="mb-4">
            <h2 className="mb-1 px-1 text-xs font-semibold tracking-wider text-ink-500 uppercase">{m}</h2>
            <Card className="!p-0">
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center">
                    <button type="button" onClick={() => setEditing(e)} className="min-h-14 min-w-0 flex-1 px-4 py-2 text-left">
                      <div className="truncate font-medium">{e.name}</div>
                      <div className="truncate text-xs text-ink-500">
                        {e.equipment}
                        {e.notes ? ` · ${e.notes}` : ''}
                      </div>
                    </button>
                    <IconButton icon="trash" label={`Delete ${e.name}`} onClick={() => remove(e)} className="mr-1" />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <ExerciseForm exercise={editing} onClose={() => setEditing(null)} />
    </>
  )
}
