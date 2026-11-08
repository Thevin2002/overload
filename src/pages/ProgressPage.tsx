import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { Card, EmptyState, PageHeader, Segmented, Select, SectionTitle, Stat, cx } from '../components/ui'
import TrendChart from '../components/charts'
import BodyCharts from '../components/BodyCharts'
import { addDays, formatDate, todayISO } from '../lib/dates'
import { exerciseSeries, exercisesByFrequency, weeklyMuscleSets } from '../lib/stats'
import { fmtNum, kgTo } from '../lib/units'

type Range = '3m' | '6m' | '1y' | 'all'
type Metric = 'heaviest' | 'e1rm' | 'volume'
const RANGE_DAYS: Record<Range, number | null> = { '3m': 91, '6m': 182, '1y': 365, all: null }

// Sequential single-hue ramp (light → dark) for the weekly-sets table.
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']

export default function ProgressPage() {
  const { allWorkouts, ensureArchive, exMap, settings } = useData()
  const [range, setRange] = useState<Range>('3m')
  const [metric, setMetric] = useState<Metric>('heaviest')
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const today = todayISO()

  useEffect(() => {
    if (range === '1y' || range === 'all') ensureArchive()
  }, [range, ensureArchive])

  const inRange = useMemo(() => {
    const days = RANGE_DAYS[range]
    const from = days ? addDays(today, -days) : ''
    return allWorkouts.filter((w) => w.date >= from)
  }, [allWorkouts, range, today])

  const ranked = useMemo(() => exercisesByFrequency(allWorkouts).filter((id) => exMap.has(id)), [allWorkouts, exMap])
  const selected = exerciseId ?? ranked[0] ?? null
  const series = useMemo(() => (selected ? exerciseSeries(inRange, selected) : []), [inRange, selected])
  const unit = settings.weightUnit
  const points = series.map((p) => ({ date: p.date, value: kgTo(p[metric], unit) }))
  const best = (k: Metric) => (series.length ? Math.max(...series.map((p) => p[k])) : null)

  const weeks = useMemo(() => weeklyMuscleSets(allWorkouts, exMap, today, 6, settings.weekStartsOn), [allWorkouts, exMap, today, settings.weekStartsOn])
  const maxCell = Math.max(1, ...weeks.rows.flatMap((r) => weeks.muscles.map((m) => r[m] as number)))

  return (
    <>
      <PageHeader title="Progress" />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '3m', label: '3M' },
          { value: '6m', label: '6M' },
          { value: '1y', label: '1Y' },
          { value: 'all', label: 'All' },
        ]}
      />

      <SectionTitle>Exercise</SectionTitle>
      {ranked.length === 0 ? (
        <EmptyState icon="chart" title="No lifts logged yet">
          Finish a workout and your strength trends appear here.
        </EmptyState>
      ) : (
        <>
          <Select value={selected ?? ''} onChange={(e) => setExerciseId(e.target.value)} aria-label="Exercise">
            {ranked.map((id) => (
              <option key={id} value={id}>
                {exMap.get(id)?.name}
              </option>
            ))}
          </Select>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Heaviest" value={fmtNum(best('heaviest') != null ? kgTo(best('heaviest')!, unit) : null, 1)} sub={unit} />
            <Stat label="Best e1RM" value={fmtNum(best('e1rm') != null ? kgTo(best('e1rm')!, unit) : null, 1)} sub={unit} />
            <Stat label="Best volume" value={fmtNum(best('volume') != null ? kgTo(best('volume')!, unit) : null, 0)} sub={unit} />
          </div>
          <Card className="mt-3">
            <Segmented
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'heaviest', label: 'Heaviest' },
                { value: 'e1rm', label: 'Est. 1RM' },
                { value: 'volume', label: 'Volume' },
              ]}
            />
            <div className="mt-3">
              {points.length >= 2 ? (
                <TrendChart data={points} unit={unit} digits={metric === 'volume' ? 0 : 1} />
              ) : (
                <p className="py-8 text-center text-sm text-ink-500">{points.length ? 'One session so far — log another to see a trend.' : 'No sessions in this range.'}</p>
              )}
            </div>
            {series.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer py-2 text-ink-500">Show as table</summary>
                <table className="w-full tabular-nums">
                  <thead className="text-left text-xs text-ink-500">
                    <tr>
                      <th className="py-1 font-medium">Date</th>
                      <th className="font-medium">Heaviest</th>
                      <th className="font-medium">e1RM</th>
                      <th className="font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...series].reverse().map((p) => (
                      <tr key={p.date} className="border-t border-ink-100 dark:border-ink-800">
                        <td className="py-1.5">{formatDate(p.date)}</td>
                        <td>{fmtNum(kgTo(p.heaviest, unit), 1)}</td>
                        <td>{fmtNum(kgTo(p.e1rm, unit), 1)}</td>
                        <td>{fmtNum(kgTo(p.volume, unit), 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </Card>
        </>
      )}

      <SectionTitle>Weekly sets per muscle</SectionTitle>
      {weeks.muscles.length === 0 ? (
        <EmptyState icon="list" title="No sets in the last 6 weeks" />
      ) : (
        <Card className="overflow-x-auto !p-3">
          <table className="w-full border-separate border-spacing-[2px] text-center text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-ink-500">
                <th className="text-left font-medium">Muscle</th>
                {weeks.rows.map((r) => (
                  <th key={r.week} className="font-medium">
                    {r.week === weeks.rows[weeks.rows.length - 1].week ? 'This' : formatDate(r.week, { day: 'numeric', month: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.muscles.map((m) => (
                <tr key={m}>
                  <td className="pr-2 text-left text-ink-600 dark:text-ink-300">{m}</td>
                  {weeks.rows.map((r) => {
                    const v = r[m] as number
                    const step = v ? Math.min(RAMP.length - 1, Math.floor((v / maxCell) * (RAMP.length - 1))) : -1
                    return (
                      <td
                        key={r.week}
                        title={`${m}, week of ${formatDate(r.week)}: ${v} sets`}
                        className={cx('h-9 min-w-9 rounded-md', step < 0 && 'bg-ink-100 text-ink-400 dark:bg-ink-800', step >= 3 ? 'text-white' : 'text-ink-900')}
                        style={step >= 0 ? { background: RAMP[step] } : undefined}
                      >
                        {v || '·'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-500">Completed working sets (drop sets not counted). Around 10–20 per muscle per week suits most people.</p>
        </Card>
      )}

      <SectionTitle>Body</SectionTitle>
      <BodyCharts />
    </>
  )
}
