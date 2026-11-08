import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { Card, IconButton, PageHeader, SectionTitle, cx } from '../components/ui'
import { HabitControls } from '../components/HabitControls'
import { addDays, formatDate, formatLongDate, startOfWeek, todayISO, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates'
import type { HabitLog } from '../types'

export function HabitsPage() {
  const { habitLogs, saveHabit, workouts, settings } = useData()
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const byDate = new Map(habitLogs.map((h) => [h.date, h]))
  const workoutDates = new Set(workouts.filter((w) => w.finishedAt).map((w) => w.date))
  const logFor = (d: string): Partial<HabitLog> => ({ ...(byDate.get(d) ?? {}), workoutDone: byDate.get(d)?.workoutDone || workoutDates.has(d) })

  const thisWeek = startOfWeek(today, settings.weekStartsOn)
  const weeks = [0, 1, 2, 3].map((i) => addDays(thisWeek, -7 * i))

  return (
    <>
      <PageHeader title="Habits" subtitle="No calorie counting — just the basics" back={() => navigate(-1)} />

      <Card>
        <div className="mb-3 flex items-center gap-1">
          <IconButton icon="chevronLeft" label="Previous day" onClick={() => setDate(addDays(date, -1))} />
          <div className="flex-1 text-center font-medium">{date === today ? 'Today' : formatLongDate(date)}</div>
          <IconButton icon="chevronRight" label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} />
        </div>
        <HabitControls log={logFor(date)} onChange={(patch) => saveHabit(date, patch)} />
      </Card>

      {weeks.map((ws) => (
        <WeekSummary key={ws} weekStart={ws} logFor={logFor} today={today} isCurrent={ws === thisWeek} onPick={setDate} selected={date} />
      ))}
    </>
  )
}

function WeekSummary({
  weekStart,
  logFor,
  today,
  isCurrent,
  onPick,
  selected,
}: {
  weekStart: string
  logFor: (d: string) => Partial<HabitLog>
  today: string
  isCurrent: boolean
  onPick: (d: string) => void
  selected: string
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const logs = days.filter((d) => d <= today).map((d) => ({ d, ...logFor(d) }))
  const avg = (k: 'meals' | 'proteinMeals' | 'energy') => {
    const vals = logs.map((l) => l[k]).filter((v): v is number => v != null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '–'
  }
  const workoutsDone = logs.filter((l) => l.workoutDone).length

  return (
    <>
      <SectionTitle>{isCurrent ? 'This week' : `Week of ${formatDate(weekStart)}`}</SectionTitle>
      <Card>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Sum label="Workouts" value={String(workoutsDone)} />
          <Sum label="Avg meals" value={avg('meals')} />
          <Sum label="Avg protein" value={avg('proteinMeals')} />
          <Sum label="Avg energy" value={avg('energy')} />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const l = logFor(d)
            const future = d > today
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                onClick={() => onPick(d)}
                aria-label={`${formatLongDate(d)}${l.workoutDone ? ', workout done' : ''}`}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-xl py-2 text-xs',
                  selected === d ? 'bg-ink-100 ring-1 ring-ink-300 dark:bg-ink-800 dark:ring-ink-600' : '',
                  future && 'opacity-40',
                )}
              >
                <span className="text-ink-500">{WEEKDAYS_SHORT[weekdayOf(d)].slice(0, 2)}</span>
                <span
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-full font-semibold',
                    l.workoutDone ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 dark:bg-ink-800',
                  )}
                >
                  {l.workoutDone ? '✓' : ''}
                </span>
                <span className="text-ink-500 tabular-nums">{l.proteinMeals != null ? `${l.proteinMeals}P` : '·'}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-500">Filled circle = workout done · “2P” = protein meals.</p>
      </Card>
    </>
  )
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-ink-500">{label}</div>
    </div>
  )
}
