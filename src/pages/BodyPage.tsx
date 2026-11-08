import { lazy, Suspense, useState } from 'react'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { Button, Card, Field, IconButton, NumberInput, PageHeader, SectionTitle, Sheet, TextInput, cx } from '../components/ui'
import { Icon } from '../components/Icon'
import { addDays, daysBetween, formatDate, todayISO } from '../lib/dates'
import { fmtNum, inTo, kgTo, toIn, toKg } from '../lib/units'
import type { BodyLog } from '../types'

const BodyCharts = lazy(() => import('../components/BodyCharts'))

export function BodyPage() {
  const { bodyLogs, settings, saveBodyLog, deleteBodyLog, updateSettings } = useData()
  const { confirm, toast } = useFeedback()
  const today = todayISO()
  const wu = settings.weightUnit
  const lu = settings.lengthUnit

  const [date, setDate] = useState(today)
  const existing = bodyLogs.find((b) => b.date === date)
  const [weight, setWeight] = useState<number | null>(null)
  const [waist, setWaist] = useState<number | null>(null)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const latestW = [...bodyLogs].reverse().find((b) => b.weightKg != null)
  const latestWaist = [...bodyLogs].reverse().find((b) => b.waistIn != null)
  const lastAny = [...bodyLogs].reverse()[0]
  const nextDue = lastAny ? addDays(lastAny.date, settings.measureEveryDays) : today
  const dueIn = daysBetween(today, nextDue)

  const save = () => {
    if (weight == null && waist == null) return
    const log: BodyLog = {
      id: date,
      date,
      weightKg: weight != null ? toKg(weight, wu) : existing?.weightKg ?? null,
      waistIn: waist != null ? toIn(waist, lu) : existing?.waistIn ?? null,
    }
    saveBodyLog(log)
    setWeight(null)
    setWaist(null)
    toast('Measurement saved')
  }

  return (
    <>
      <PageHeader title="Body" right={<Button size="sm" variant="secondary" onClick={() => setGoalsOpen(true)}>Goals</Button>} />

      <div className={cx('mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm', dueIn <= 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300')}>
        <Icon name="calendar" size={16} />
        {dueIn <= 0 ? 'Measurement due today — same time of day, ideally after waking.' : `Next check-in in ${dueIn} day${dueIn === 1 ? '' : 's'} (every ${settings.measureEveryDays} days).`}
      </div>

      <GoalCard
        title="Weight"
        unit={wu}
        start={settings.startWeightKg != null ? kgTo(settings.startWeightKg, wu) : null}
        goal={settings.goalWeightKg != null ? kgTo(settings.goalWeightKg, wu) : null}
        current={latestW?.weightKg != null ? kgTo(latestW.weightKg, wu) : null}
      />
      <div className="h-3" />
      <GoalCard
        title="Waist"
        unit={lu}
        start={settings.startWaistIn != null ? inTo(settings.startWaistIn, lu) : null}
        goal={settings.goalWaistIn != null ? inTo(settings.goalWaistIn, lu) : null}
        current={latestWaist?.waistIn != null ? inTo(latestWaist.waistIn, lu) : null}
      />

      <SectionTitle>Log a measurement</SectionTitle>
      <Card className="space-y-3">
        <Field label="Date">
          <TextInput type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${wu})`}>
            <NumberInput value={weight} onChange={setWeight} placeholder={existing?.weightKg != null ? fmtNum(kgTo(existing.weightKg, wu), 1) : ''} />
          </Field>
          <Field label={`Waist (${lu})`}>
            <NumberInput value={waist} onChange={setWaist} placeholder={existing?.waistIn != null ? fmtNum(inTo(existing.waistIn, lu), 1) : ''} />
          </Field>
        </div>
        <Button block onClick={save} disabled={weight == null && waist == null}>
          {existing ? 'Update' : 'Save'}
        </Button>
      </Card>

      <SectionTitle>Trends</SectionTitle>
      <Suspense fallback={<p className="py-6 text-center text-sm text-ink-500">Loading charts…</p>}>
        <BodyCharts />
      </Suspense>

      {bodyLogs.length > 0 && (
        <>
          <SectionTitle>History</SectionTitle>
          <Card className="!p-0">
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {[...bodyLogs].reverse().map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
                  <div className="w-20 text-sm text-ink-500">{formatDate(b.date, { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                  <div className="flex-1 tabular-nums">
                    {b.weightKg != null && `${fmtNum(kgTo(b.weightKg, wu), 1)} ${wu}`}
                    {b.weightKg != null && b.waistIn != null && ' · '}
                    {b.waistIn != null && `${fmtNum(inTo(b.waistIn, lu), 1)} ${lu}`}
                  </div>
                  <IconButton
                    icon="trash"
                    label="Delete measurement"
                    onClick={async () => {
                      if (await confirm({ title: `Delete the ${formatDate(b.date)} measurement?`, confirmLabel: 'Delete', danger: true })) deleteBodyLog(b.id)
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} settings={settings} onSave={updateSettings} />
    </>
  )
}

function GoalCard({ title, unit, start, goal, current }: { title: string; unit: string; start: number | null; goal: number | null; current: number | null }) {
  const now = current ?? start
  const losing = start != null && goal != null ? goal < start : true
  const changed = start != null && now != null ? (losing ? start - now : now - start) : null
  const left = goal != null && now != null ? (losing ? now - goal : goal - now) : null
  const pct = start != null && goal != null && now != null && start !== goal ? Math.max(0, Math.min(100, ((losing ? start - now : now - start) / Math.abs(start - goal)) * 100)) : 0
  const verb = losing ? 'Lost' : 'Gained'

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-ink-500 tabular-nums">
          {fmtNum(start, 1)} → {fmtNum(goal, 1)} {unit}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Mini label="Current" value={fmtNum(now, 1)} unit={unit} />
        <Mini label={`${verb} since start`} value={changed == null ? '–' : fmtNum(changed, 1)} unit={unit} />
        <Mini label="Left to goal" value={left == null ? '–' : left <= 0 ? 'Done!' : fmtNum(left, 1)} unit={left != null && left > 0 ? unit : ''} />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress to goal`}>
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-right text-xs text-ink-500 tabular-nums">{Math.round(pct)}% of the way</div>
    </Card>
  )
}

function Mini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-ink-500">{unit}</span>}
      </div>
    </div>
  )
}

function GoalsSheet({ open, onClose, settings, onSave }: { open: boolean; onClose: () => void; settings: ReturnType<typeof useData>['settings']; onSave: ReturnType<typeof useData>['updateSettings'] }) {
  const wu = settings.weightUnit
  const lu = settings.lengthUnit
  const init = () => ({
    sw: settings.startWeightKg != null ? +fmtNum(kgTo(settings.startWeightKg, wu), 1) : null,
    gw: settings.goalWeightKg != null ? +fmtNum(kgTo(settings.goalWeightKg, wu), 1) : null,
    sx: settings.startWaistIn != null ? +fmtNum(inTo(settings.startWaistIn, lu), 1) : null,
    gx: settings.goalWaistIn != null ? +fmtNum(inTo(settings.goalWaistIn, lu), 1) : null,
    every: settings.measureEveryDays,
    startDate: settings.startDate,
  })
  const [v, setV] = useState(init)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(init())
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Start & goal"
      footer={
        <Button
          block
          onClick={() => {
            onSave({
              startWeightKg: v.sw != null ? toKg(v.sw, wu) : null,
              goalWeightKg: v.gw != null ? toKg(v.gw, wu) : null,
              startWaistIn: v.sx != null ? toIn(v.sx, lu) : null,
              goalWaistIn: v.gx != null ? toIn(v.gx, lu) : null,
              measureEveryDays: Math.max(1, v.every || 14),
              startDate: v.startDate,
            })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Start weight (${wu})`}>
            <NumberInput value={v.sw} onChange={(sw) => setV({ ...v, sw })} />
          </Field>
          <Field label={`Goal weight (${wu})`}>
            <NumberInput value={v.gw} onChange={(gw) => setV({ ...v, gw })} />
          </Field>
          <Field label={`Start waist (${lu})`}>
            <NumberInput value={v.sx} onChange={(sx) => setV({ ...v, sx })} />
          </Field>
          <Field label={`Goal waist (${lu})`}>
            <NumberInput value={v.gx} onChange={(gx) => setV({ ...v, gx })} />
          </Field>
        </div>
        <Field label="Start date">
          <TextInput type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
        </Field>
        <Field label="Remind me to measure every (days)">
          <NumberInput decimal={false} value={v.every} onChange={(every) => setV({ ...v, every: every ?? 14 })} />
        </Field>
      </div>
    </Sheet>
  )
}
