import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useAuth } from '../data/AuthContext'
import { Badge, Button, Card, PageHeader, SectionTitle, Sheet, Toggle } from '../components/ui'
import { Icon } from '../components/Icon'
import { HabitControls } from '../components/HabitControls'
import { daysBetween, formatLongDate, todayISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates'
import { dayForWeekday, exerciseCount } from '../lib/plan'
import { buildWorkout } from '../lib/workout'
import { summarizeWorkout } from '../lib/stats'
import { toKg } from '../lib/units'
import type { PlanDay, Session } from '../types'

export function TodayPage() {
  const { activePlan, workouts, allWorkouts, settings, saveWorkout, habitLogs, saveHabit, bodyLogs } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()
  const todayDay = dayForWeekday(activePlan, weekdayOf(today))
  const [othersOpen, setOthersOpen] = useState(false)
  const [starting, setStarting] = useState<{ day: PlanDay; session: Session } | null>(null)
  const [withAbs, setWithAbs] = useState(true)

  const inProgress = workouts.find((w) => !w.finishedAt)
  const doneToday = workouts.filter((w) => w.date === today && w.finishedAt)
  const habit = habitLogs.find((h) => h.date === today) ?? { workoutDone: doneToday.length > 0 }
  const lastBody = [...bodyLogs].reverse().find((b) => b.weightKg != null || b.waistIn != null)
  const measureDue = !lastBody || daysBetween(lastBody.date, today) >= settings.measureEveryDays

  const stepKg = settings.weightUnit === 'kg' ? settings.stepKg : toKg(settings.stepLb, 'lb')
  const start = (day: PlanDay | null, session: Session | null, includeAbs: boolean) => {
    const w = buildWorkout({
      planId: activePlan?.id ?? null,
      day,
      session,
      absRoutine: activePlan?.absRoutine ?? [],
      includeAbs,
      history: allWorkouts,
      stepKg,
    })
    saveWorkout(w)
    navigate(`/log/${w.id}`)
  }
  const askStart = (day: PlanDay, session: Session) => {
    setWithAbs(day.includeAbs)
    setStarting({ day, session })
  }

  const hello = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const first = user?.name?.split(' ')[0]

  return (
    <>
      <PageHeader title={`${hello}${first && !user?.demo ? `, ${first}` : ''}`} subtitle={formatLongDate(today)} />

      {user?.demo && (
        <p className="mb-3 rounded-xl bg-ink-100 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          Demo mode — data is stored only on this device. Sign out (More → Settings) and sign in to sync.
        </p>
      )}

      {inProgress && (
        <Card onClick={() => navigate(`/log/${inProgress.id}`)} className="mb-3 flex items-center gap-3 !bg-brand-500 !text-white !ring-brand-600">
          <Icon name="play" size={22} />
          <div className="flex-1">
            <div className="font-semibold">Resume workout</div>
            <div className="text-sm opacity-90">
              {inProgress.title} · {summarizeWorkout(inProgress).sets} sets logged
            </div>
          </div>
          <Icon name="chevronRight" />
        </Card>
      )}

      <SectionTitle>Today’s training</SectionTitle>
      {!activePlan ? (
        <Card>
          <p className="text-ink-600 dark:text-ink-300">No active plan.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => navigate('/plan')}>Set up plan</Button>
            <Button size="sm" variant="secondary" onClick={() => start(null, null, false)}>Empty workout</Button>
          </div>
        </Card>
      ) : todayDay && !todayDay.rest ? (
        <DayCard day={todayDay} onStart={askStart} highlight />
      ) : (
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800">
              <Icon name="heart" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{todayDay ? todayDay.name || 'Rest day' : 'Nothing scheduled'}</div>
              <div className="text-sm text-ink-500">{todayDay ? 'Recover well — eat, sleep, walk.' : 'No plan day is set for today.'}</div>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOthersOpen(true)}>
            Train anyway
          </Button>
        </Card>
      )}

      {doneToday.length > 0 && (
        <div className="mt-2 space-y-2">
          {doneToday.map((w) => (
            <Card key={w.id} onClick={() => navigate(`/log/${w.id}`)} className="flex items-center gap-3 !py-3">
              <Icon name="check" className="text-brand-500" />
              <div className="flex-1">
                <div className="font-medium">{w.title}</div>
                <div className="text-xs text-ink-500">Completed · {summarizeWorkout(w).sets} sets</div>
              </div>
              <Icon name="chevronRight" size={18} className="text-ink-400" />
            </Card>
          ))}
        </div>
      )}

      {activePlan && (
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" icon="calendar" onClick={() => setOthersOpen(true)}>
            Pick another day
          </Button>
          <Button variant="ghost" size="sm" icon="plus" onClick={() => start(null, null, false)}>
            Empty workout
          </Button>
        </div>
      )}

      {measureDue && (
        <Card onClick={() => navigate('/body')} className="mt-4 flex items-center gap-3">
          <Icon name="scale" className="text-brand-500" />
          <div className="flex-1">
            <div className="font-medium">Time to measure</div>
            <div className="text-sm text-ink-500">
              {lastBody ? `Last check-in ${daysBetween(lastBody.date, today)} days ago.` : 'Log your weight and waist to track progress.'} Every{' '}
              {settings.measureEveryDays} days is enough.
            </div>
          </div>
          <Icon name="chevronRight" size={18} className="text-ink-400" />
        </Card>
      )}

      <SectionTitle right={<button type="button" onClick={() => navigate('/habits')} className="text-sm text-brand-600 dark:text-brand-400">Week</button>}>
        Daily check-in
      </SectionTitle>
      <Card>
        <HabitControls log={habit} onChange={(patch) => saveHabit(today, patch)} />
      </Card>

      <Sheet open={othersOpen} onClose={() => setOthersOpen(false)} title="Choose a day">
        <div className="space-y-2">
          {activePlan?.days
            .filter((d) => !d.rest)
            .map((d) => (
              <DayCard
                key={d.id}
                day={d}
                onStart={(day, s) => {
                  setOthersOpen(false)
                  askStart(day, s)
                }}
              />
            ))}
        </div>
      </Sheet>

      <Sheet
        open={!!starting}
        onClose={() => setStarting(null)}
        title={starting?.day.name}
        footer={
          <Button
            block
            size="lg"
            icon="play"
            onClick={() => {
              if (!starting) return
              start(starting.day, starting.session, withAbs)
              setStarting(null)
            }}
          >
            Start workout
          </Button>
        }
      >
        {starting && (
          <>
            <ul className="mb-3 space-y-1 text-sm text-ink-600 dark:text-ink-300">
              {starting.session.items.map((it) => (
                <ItemLine key={it.id} ids={it.exerciseIds} sets={it.sets} min={it.repMin} max={it.repMax} />
              ))}
            </ul>
            {(activePlan?.absRoutine.length ?? 0) > 0 && <Toggle checked={withAbs} onChange={setWithAbs} label="Include abs routine" />}
          </>
        )}
      </Sheet>
    </>
  )
}

function ItemLine({ ids, sets, min, max }: { ids: string[]; sets: number; min: number; max: number }) {
  const { exMap } = useData()
  return (
    <li className="flex gap-2">
      <span className="min-w-0 flex-1 truncate">{ids.map((id) => exMap.get(id)?.name ?? '?').join(' + ')}</span>
      <span className="shrink-0 text-ink-500 tabular-nums">
        {sets}
        {ids.length > 1 ? ' rds' : ' ×'} {min}–{max}
      </span>
    </li>
  )
}

function DayCard({ day, onStart, highlight }: { day: PlanDay; onStart: (d: PlanDay, s: Session) => void; highlight?: boolean }) {
  const { exMap } = useData()
  return (
    <Card className={highlight ? '!ring-2 !ring-brand-500/40' : ''}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {day.weekday != null && <Badge>{WEEKDAYS_SHORT[day.weekday]}</Badge>}
            {day.includeAbs && <Badge tone="violet">+ Abs</Badge>}
          </div>
          <div className="mt-1 text-lg font-semibold">{day.name}</div>
          <div className="text-sm text-ink-500">{exerciseCount(day)} exercises</div>
        </div>
      </div>
      {highlight && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-500">
          {day.sessions[0]?.items.map((it) => it.exerciseIds.map((id) => exMap.get(id)?.name ?? '?').join(' + ')).join(' · ')}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {day.sessions.map((s) => (
          <Button key={s.id} block={highlight} icon="play" variant={highlight ? 'primary' : 'secondary'} onClick={() => onStart(day, s)} disabled={s.items.length === 0}>
            {day.sessions.length > 1 ? `Start ${s.name}` : 'Start'}
          </Button>
        ))}
      </div>
    </Card>
  )
}
