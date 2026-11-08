import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { Badge, Button, Card, EmptyState, Field, IconButton, PageHeader, SectionTitle, Sheet, TextInput } from '../components/ui'
import { Icon } from '../components/Icon'
import { WEEKDAYS_SHORT } from '../lib/dates'
import { duplicatePlan, exerciseCount, move, newDay, newPlan } from '../lib/plan'
import type { Plan } from '../types'

export function PlanPage() {
  const { plans, activePlan, settings, updateSettings, savePlan, deletePlan, resetToSeedPlan } = useData()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const [naming, setNaming] = useState<{ mode: 'new' | 'rename' | 'duplicate'; name: string } | null>(null)

  const plan = plans.find((p) => p.id === selectedId) ?? activePlan
  const isActive = plan?.id === settings.activePlanId || (!settings.activePlanId && plan === activePlan)

  const update = (p: Plan) => savePlan(p)

  const addDay = () => {
    if (!plan) return
    const used = new Set(plan.days.map((d) => d.weekday))
    const free = [1, 2, 3, 4, 5, 6, 0].find((w) => !used.has(w)) ?? null
    const day = newDay(`Day ${plan.days.length + 1}`, free)
    update({ ...plan, days: [...plan.days, day] })
    navigate(`/plan/${plan.id}/day/${day.id}`)
  }

  const submitName = () => {
    if (!naming) return
    const name = naming.name.trim() || 'Untitled plan'
    if (naming.mode === 'new') {
      const p = newPlan(name)
      savePlan(p)
      setSelectedId(p.id)
    } else if (naming.mode === 'duplicate' && plan) {
      const p = duplicatePlan(plan, name)
      savePlan(p)
      setSelectedId(p.id)
    } else if (plan) update({ ...plan, name })
    setNaming(null)
    setPlansOpen(false)
  }

  return (
    <>
      <PageHeader
        title={plan?.name ?? 'Plan'}
        subtitle={plan ? (isActive ? 'Active plan' : 'Not active') : undefined}
        right={<Button variant="secondary" size="sm" onClick={() => setPlansOpen(true)}>Plans</Button>}
      />

      {!plan ? (
        <EmptyState
          icon="calendar"
          title="No plan yet"
          action={
            <div className="flex flex-col gap-2">
              <Button icon="plus" onClick={() => setNaming({ mode: 'new', name: 'My plan' })}>Create a plan</Button>
              <Button variant="secondary" onClick={resetToSeedPlan}>Load the default plan</Button>
            </div>
          }
        >
          Build your weekly schedule with training days, rest days and sessions.
        </EmptyState>
      ) : (
        <>
          {!isActive && (
            <Card className="mb-3 flex items-center gap-3">
              <div className="flex-1 text-sm">This plan isn’t active. Today’s workout comes from the active plan.</div>
              <Button size="sm" onClick={() => updateSettings({ activePlanId: plan.id })}>Make active</Button>
            </Card>
          )}

          <SectionTitle>Weekly schedule</SectionTitle>
          {plan.days.length === 0 ? (
            <EmptyState icon="calendar" title="No days yet" action={<Button icon="plus" onClick={addDay}>Add a day</Button>}>
              Add training and rest days. Link each to a weekday so Overload can suggest today’s session.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {plan.days.map((d, i) => (
                <li key={d.id} className="flex items-stretch gap-1">
                  <Card onClick={() => navigate(`/plan/${plan.id}/day/${d.id}`)} className="flex flex-1 items-center gap-3 !py-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-100 text-xs font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      {d.weekday != null ? WEEKDAYS_SHORT[d.weekday] : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {d.rest ? (
                          <Badge>Rest day</Badge>
                        ) : (
                          <Badge>
                            {exerciseCount(d)} exercises{d.sessions.length > 1 ? ` · ${d.sessions.length} sessions` : ''}
                          </Badge>
                        )}
                        {d.includeAbs && <Badge tone="violet">+ Abs</Badge>}
                      </div>
                    </div>
                    <Icon name="chevronRight" size={18} className="text-ink-400" />
                  </Card>
                  <div className="flex flex-col justify-center">
                    <IconButton icon="up" label="Move up" size={36} disabled={i === 0} onClick={() => update({ ...plan, days: move(plan.days, i, -1) })} />
                    <IconButton
                      icon="down"
                      label="Move down"
                      size={36}
                      disabled={i === plan.days.length - 1}
                      onClick={() => update({ ...plan, days: move(plan.days, i, 1) })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {plan.days.length > 0 && (
            <Button variant="secondary" icon="plus" block className="mt-3" onClick={addDay}>
              Add day
            </Button>
          )}

          <SectionTitle>Add-ons</SectionTitle>
          <Card onClick={() => navigate(`/plan/${plan.id}/abs`)} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Icon name="flame" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Abs routine</div>
              <div className="text-sm text-ink-500">
                {plan.absRoutine.length} exercises · on{' '}
                {plan.days.filter((d) => d.includeAbs).map((d) => (d.weekday != null ? WEEKDAYS_SHORT[d.weekday] : d.name)).join(', ') || 'no days yet'}
              </div>
            </div>
            <Icon name="chevronRight" size={18} className="text-ink-400" />
          </Card>

          <SectionTitle>Library</SectionTitle>
          <Card onClick={() => navigate('/exercises')} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-700/25 dark:text-brand-300">
              <Icon name="dumbbell" />
            </div>
            <div className="flex-1 font-medium">Exercise library</div>
            <Icon name="chevronRight" size={18} className="text-ink-400" />
          </Card>
        </>
      )}

      <Sheet open={plansOpen} onClose={() => setPlansOpen(false)} title="Your plans">
        <ul className="space-y-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Card
                onClick={() => {
                  setSelectedId(p.id)
                  setPlansOpen(false)
                }}
                className="flex items-center gap-2 !py-3"
              >
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-ink-500">{p.days.length} days</div>
                </div>
                {p.id === activePlan?.id && <Badge tone="brand">Active</Badge>}
                {p.id === plan?.id && <Icon name="check" size={18} className="text-brand-500" />}
              </Card>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" icon="plus" onClick={() => setNaming({ mode: 'new', name: '' })}>New</Button>
          {plan && <Button variant="secondary" icon="copy" onClick={() => setNaming({ mode: 'duplicate', name: `${plan.name} (copy)` })}>Duplicate</Button>}
          {plan && <Button variant="secondary" icon="edit" onClick={() => setNaming({ mode: 'rename', name: plan.name })}>Rename</Button>}
          {plan && (
            <Button
              variant="secondary"
              icon="trash"
              className="!text-red-600"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete “${plan.name}”?`,
                  message: 'The plan is removed. Your logged workouts are kept.',
                  confirmLabel: 'Delete plan',
                  danger: true,
                })
                if (!ok) return
                deletePlan(plan.id)
                const next = plans.find((p) => p.id !== plan.id)
                if (isActive) updateSettings({ activePlanId: next?.id ?? null })
                setSelectedId(next?.id ?? null)
                setPlansOpen(false)
                toast('Plan deleted')
              }}
            >
              Delete
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          block
          className="mt-3"
          onClick={async () => {
            const ok = await confirm({
              title: 'Restore the default plan?',
              message: 'Loads the original 6-day split as “My split” (overwriting that plan if it still exists) and makes it active.',
              confirmLabel: 'Restore',
            })
            if (ok) {
              resetToSeedPlan()
              setSelectedId(null)
              setPlansOpen(false)
            }
          }}
        >
          Restore default plan
        </Button>
      </Sheet>

      <Sheet
        open={!!naming}
        onClose={() => setNaming(null)}
        title={naming?.mode === 'rename' ? 'Rename plan' : naming?.mode === 'duplicate' ? 'Duplicate plan' : 'New plan'}
        footer={<Button block onClick={submitName}>Save</Button>}
      >
        <form onSubmit={(e) => (e.preventDefault(), submitName())}>
          <Field label="Plan name">
            <TextInput autoFocus value={naming?.name ?? ''} onChange={(e) => setNaming((n) => (n ? { ...n, name: e.target.value } : n))} />
          </Field>
        </form>
      </Sheet>
    </>
  )
}
