import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { Badge, Button, Card, EmptyState, Field, IconButton, NumberInput, PageHeader, Segmented, Select, SectionTitle, Stepper, TextArea, TextInput, Toggle, cx } from '../components/ui'
import { Icon } from '../components/Icon'
import { ExercisePicker } from '../components/ExercisePicker'
import { WEEKDAYS } from '../lib/dates'
import { itemNames, move, newItem, targetLabel } from '../lib/plan'
import { newId } from '../lib/id'
import { useAutosave } from '../lib/useAutosave'
import type { Exercise, Plan, PlanDay, PlanItem } from '../types'

export function DayEditorPage({ abs = false }: { abs?: boolean }) {
  const { planId, dayId } = useParams()
  const { plans, savePlan } = useData()
  const { confirm } = useFeedback()
  const navigate = useNavigate()
  const source = plans.find((p) => p.id === planId)
  const [draft, setDraft] = useState<Plan | null>(null)

  // Initialise the local draft once the plan is available (it may arrive a tick after navigation).
  if (!draft && source && (abs || source.days.some((d) => d.id === dayId))) setDraft(source)
  const autosave = useAutosave(draft, savePlan)

  if (!draft) {
    return (
      <>
        <PageHeader title="Edit day" back={() => navigate('/plan')} />
        <EmptyState icon="calendar" title={source ? 'Day not found' : 'Loading…'} />
      </>
    )
  }

  if (abs) {
    return (
      <>
        <PageHeader title="Abs routine" subtitle="Added on days with “Include abs” on" back={() => navigate('/plan')} />
        <ItemList items={draft.absRoutine} onChange={(items) => setDraft({ ...draft, absRoutine: items })} />
      </>
    )
  }

  const day = draft.days.find((d) => d.id === dayId)!
  const setDay = (patch: Partial<PlanDay>) => setDraft({ ...draft, days: draft.days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)) })

  return (
    <>
      <PageHeader
        title={day.name || 'Untitled day'}
        subtitle="Changes save automatically"
        back={() => navigate('/plan')}
        right={
          <IconButton
            icon="trash"
            label="Delete day"
            onClick={async () => {
              const ok = await confirm({ title: `Delete “${day.name}”?`, message: 'Logged workouts are kept.', confirmLabel: 'Delete day', danger: true })
              if (!ok) return
              autosave.cancel()
              savePlan({ ...draft, days: draft.days.filter((d) => d.id !== day.id) })
              navigate('/plan')
            }}
          />
        }
      />

      <Card className="space-y-4">
        <Field label="Day name">
          <TextInput value={day.name} onChange={(e) => setDay({ name: e.target.value })} placeholder="e.g. Push A" />
        </Field>
        <Field label="Weekday" hint="Used to suggest today’s workout">
          <Select value={day.weekday ?? ''} onChange={(e) => setDay({ weekday: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">No fixed weekday</option>
            {[1, 2, 3, 4, 5, 6, 0].map((w) => (
              <option key={w} value={w}>
                {WEEKDAYS[w]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          <Toggle checked={day.rest} onChange={(rest) => setDay({ rest })} label="Rest day" />
          {!day.rest && <Toggle checked={day.includeAbs} onChange={(includeAbs) => setDay({ includeAbs })} label="Include abs routine" hint="Edit it from the Plan page" />}
        </div>
      </Card>

      {!day.rest &&
        day.sessions.map((s, si) => (
          <section key={s.id}>
            <SectionTitle
              right={
                day.sessions.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={async () => {
                      const ok = await confirm({ title: `Remove session “${s.name}”?`, confirmLabel: 'Remove', danger: true })
                      if (ok) setDay({ sessions: day.sessions.filter((x) => x.id !== s.id) })
                    }}
                  >
                    Remove session
                  </button>
                )
              }
            >
              Session {si + 1}
            </SectionTitle>
            <TextInput
              className="mb-2"
              value={s.name}
              aria-label="Session name"
              onChange={(e) => setDay({ sessions: day.sessions.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })}
            />
            <ItemList items={s.items} onChange={(items) => setDay({ sessions: day.sessions.map((x) => (x.id === s.id ? { ...x, items } : x)) })} />
          </section>
        ))}

      {!day.rest && (
        <Button
          variant="ghost"
          icon="plus"
          block
          className="mt-4"
          onClick={() => setDay({ sessions: [...day.sessions, { id: newId(), name: `Session ${day.sessions.length + 1}`, items: [] }] })}
        >
          Add another session (e.g. AM / PM)
        </Button>
      )}
    </>
  )
}

type PickerMode = { kind: 'add' } | { kind: 'superset1' } | { kind: 'superset2'; first: string } | { kind: 'swap'; itemId: string; index: number; muscle?: string }

function ItemList({ items, onChange }: { items: PlanItem[]; onChange: (items: PlanItem[]) => void }) {
  const { exMap } = useData()
  const { confirm } = useFeedback()
  const [picker, setPicker] = useState<PickerMode | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const patch = (id: string, p: Partial<PlanItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)))

  const onPick = (ex: Exercise) => {
    if (!picker) return
    if (picker.kind === 'add') onChange([...items, newItem([ex.id])])
    else if (picker.kind === 'superset1') return setPicker({ kind: 'superset2', first: ex.id })
    else if (picker.kind === 'superset2') onChange([...items, newItem([picker.first, ex.id])])
    else if (picker.kind === 'swap') {
      const it = items.find((i) => i.id === picker.itemId)
      if (it) patch(it.id, { exerciseIds: it.exerciseIds.map((id, k) => (k === picker.index ? ex.id : id)) })
    }
    setPicker(null)
  }

  return (
    <>
      {items.length === 0 ? (
        <EmptyState icon="dumbbell" title="No exercises yet">
          Add exercises or a superset below.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const open = expanded === it.id
            const superset = it.exerciseIds.length > 1
            return (
              <li key={it.id}>
                <Card className="!p-0">
                  <div className="flex items-center gap-1 p-2 pl-3">
                    <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => setExpanded(open ? null : it.id)} aria-expanded={open}>
                      <div className="truncate font-medium">{itemNames(it, exMap)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-ink-500">
                        <span className="tabular-nums">{targetLabel(it)}</span>
                        {superset && <Badge tone="amber">Superset</Badge>}
                        {it.dropLast && <Badge tone="red">Drop last</Badge>}
                      </div>
                    </button>
                    {!superset && (
                      <IconButton
                        icon="swap"
                        label="Swap exercise"
                        onClick={() => setPicker({ kind: 'swap', itemId: it.id, index: 0, muscle: exMap.get(it.exerciseIds[0])?.muscle })}
                      />
                    )}
                    <IconButton icon="up" label="Move up" size={36} disabled={i === 0} onClick={() => onChange(move(items, i, -1))} />
                    <IconButton icon="down" label="Move down" size={36} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} />
                  </div>

                  {open && (
                    <div className="space-y-4 border-t border-ink-100 p-3 dark:border-ink-800">
                      {it.exerciseIds.map((id, k) => (
                        <div key={k} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-ink-500">{superset ? `Exercise ${String.fromCharCode(65 + k)}` : 'Exercise'}</div>
                            <div className="truncate">{exMap.get(id)?.name ?? 'Unknown'}</div>
                          </div>
                          <Button size="sm" variant="secondary" icon="swap" onClick={() => setPicker({ kind: 'swap', itemId: it.id, index: k, muscle: exMap.get(id)?.muscle })}>
                            Swap
                          </Button>
                          {superset && (
                            <IconButton icon="x" label="Remove from superset" size={36} onClick={() => patch(it.id, { exerciseIds: it.exerciseIds.filter((_, x) => x !== k) })} />
                          )}
                        </div>
                      ))}
                      {!superset && (
                        <Button size="sm" variant="ghost" icon="plus" onClick={() => setPicker({ kind: 'superset2', first: it.exerciseIds[0] })}>
                          Turn into superset
                        </Button>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <Field label={superset ? 'Rounds' : 'Sets'}>
                          <Stepper label="sets" step={1} decimal={false} min={1} value={it.sets} onChange={(v) => patch(it.id, { sets: Math.max(1, v ?? 1) })} />
                        </Field>
                        <Field label="Min">
                          <Stepper label="minimum reps" step={it.repUnit === 'sec' ? 5 : 1} decimal={false} min={1} value={it.repMin} onChange={(v) => patch(it.id, { repMin: v ?? 1, repMax: Math.max(v ?? 1, it.repMax) })} />
                        </Field>
                        <Field label="Max">
                          <Stepper label="maximum reps" step={it.repUnit === 'sec' ? 5 : 1} decimal={false} min={1} value={it.repMax} onChange={(v) => patch(it.id, { repMax: Math.max(v ?? 1, it.repMin) })} />
                        </Field>
                      </div>
                      <Segmented
                        value={it.repUnit}
                        onChange={(repUnit) => patch(it.id, { repUnit })}
                        options={[
                          { value: 'reps', label: 'Reps' },
                          { value: 'sec', label: 'Seconds (timed)' },
                        ]}
                      />
                      <div className="divide-y divide-ink-100 dark:divide-ink-800">
                        <Toggle checked={it.perSide} onChange={(perSide) => patch(it.id, { perSide })} label="Per side / per leg" />
                        <Toggle checked={it.dropLast} onChange={(dropLast) => patch(it.id, { dropLast })} label="Drop set on last set" />
                      </div>
                      <Field label="Rest (seconds)" hint="Leave empty to use the default from Settings">
                        <NumberInput decimal={false} value={it.restSec ?? null} onChange={(restSec) => patch(it.id, { restSec })} placeholder="default" className="text-left" />
                      </Field>
                      <Field label="Notes">
                        <TextArea rows={2} value={it.notes} onChange={(e) => patch(it.id, { notes: e.target.value })} placeholder="Tempo, cues…" />
                      </Field>
                      <Button
                        variant="ghost"
                        icon="trash"
                        className="!text-red-600"
                        onClick={async () => {
                          const ok = await confirm({ title: `Remove ${itemNames(it, exMap)}?`, confirmLabel: 'Remove', danger: true })
                          if (ok) onChange(items.filter((x) => x.id !== it.id))
                        }}
                      >
                        Remove from day
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <div className={cx('mt-3 grid grid-cols-2 gap-2')}>
        <Button variant="secondary" icon="plus" onClick={() => setPicker({ kind: 'add' })}>
          Exercise
        </Button>
        <Button variant="secondary" icon="plus" onClick={() => setPicker({ kind: 'superset1' })}>
          Superset
        </Button>
      </div>
      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={onPick}
        preferMuscle={picker?.kind === 'swap' ? picker.muscle : undefined}
        title={
          picker?.kind === 'swap'
            ? 'Swap for…'
            : picker?.kind === 'superset1'
              ? 'Superset: first exercise'
              : picker?.kind === 'superset2'
                ? 'Superset: second exercise'
                : 'Add exercise'
        }
      />
      <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-ink-500">
        <Icon name="info" size={14} /> Tap an exercise to edit sets, reps, drop sets and notes.
      </p>
    </>
  )
}
