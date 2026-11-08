import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RECENT_WORKOUT_DAYS, sortWorkouts, useData } from '../data/DataContext'
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle } from '../components/ui'
import { Icon } from '../components/Icon'
import { addDays, formatDate, todayISO } from '../lib/dates'
import { summarizeWorkout } from '../lib/stats'
import { fmtNum, kgTo } from '../lib/units'
import type { Workout } from '../types'

const PAGE_DAYS = 120

export function HistoryPage() {
  const { workouts, loadWorkouts, settings } = useData()
  const navigate = useNavigate()
  const [older, setOlder] = useState<Workout[]>([])
  // Everything newer than `cursor` is loaded. Starts at the edge of the live window.
  const [cursor, setCursor] = useState(addDays(todayISO(), -RECENT_WORKOUT_DAYS))
  const [loading, setLoading] = useState(false)
  const [exhausted, setExhausted] = useState(false)

  const loadMore = async () => {
    setLoading(true)
    try {
      const to = addDays(cursor, -1)
      const from = addDays(cursor, -PAGE_DAYS)
      const page = await loadWorkouts({ from, to, order: 'desc' })
      setOlder((o) => sortWorkouts([...o, ...page]))
      setCursor(from)
      // Stop offering more after two empty windows in a row (~8 months with nothing).
      if (!page.length) {
        const next = await loadWorkouts({ to: addDays(from, -1), order: 'desc', limit: 1 })
        if (!next.length) setExhausted(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const all = [...workouts, ...older]
  const byMonth = new Map<string, Workout[]>()
  for (const w of all) {
    const key = w.date.slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) || []), w])
  }

  return (
    <>
      <PageHeader title="History" subtitle={`${all.length} workouts loaded`} back={() => navigate(-1)} />
      {all.length === 0 && (
        <EmptyState icon="history" title="No workouts yet">
          Your finished workouts will be listed here.
        </EmptyState>
      )}
      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month}>
          <SectionTitle>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</SectionTitle>
          <div className="space-y-2">
            {list.map((w) => {
              const s = summarizeWorkout(w)
              return (
                <Card key={w.id} onClick={() => navigate(`/log/${w.id}`)} className="flex items-center gap-3 !py-3">
                  <div className="w-12 text-center">
                    <div className="text-lg leading-none font-semibold">{Number(w.date.slice(8))}</div>
                    <div className="text-xs text-ink-500">{formatDate(w.date, { weekday: 'short' })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{w.title}</div>
                    <div className="text-xs text-ink-500 tabular-nums">
                      {s.exercises} exercises · {s.sets} sets · {fmtNum(kgTo(s.volume, settings.weightUnit), 0)} {settings.weightUnit}
                    </div>
                  </div>
                  {!w.finishedAt && <Badge tone="brand">In progress</Badge>}
                  <Icon name="chevronRight" size={18} className="text-ink-400" />
                </Card>
              )
            })}
          </div>
        </section>
      ))}
      {!exhausted && (
        <Button variant="secondary" block className="mt-4" disabled={loading} onClick={loadMore}>
          {loading ? 'Loading…' : `Load older (before ${formatDate(cursor, { day: 'numeric', month: 'short', year: 'numeric' })})`}
        </Button>
      )}
    </>
  )
}
