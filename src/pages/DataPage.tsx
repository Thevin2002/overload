import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useFeedback } from '../components/Feedback'
import { Button, Card, Field, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { downloadFile, toCSV } from '../lib/csv'
import { CSV_TEMPLATE, parseImportCsv, type DateOrder, type ParsedImport } from '../lib/importCsv'
import { fmtNum, inTo, kgTo } from '../lib/units'
import { fromISODate, todayISO } from '../lib/dates'
import { newId, slugId } from '../lib/id'
import type { BodyLog, CollectionName, Exercise, HabitLog, Plan, Settings, Workout } from '../types'
import type { WriteItem } from '../data/backend'

interface Backup {
  app: 'overload'
  version: 1
  exportedAt: string
  settings: Settings | null
  exercises: Exercise[]
  plans: Plan[]
  workouts: Workout[]
  bodyLogs: BodyLog[]
  habitLogs: HabitLog[]
}

export function DataPage() {
  const { backend, settings, exMap, exercises, bodyLogs } = useData()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy')
  const [csvUnit, setCsvUnit] = useState(settings.weightUnit)
  const [preview, setPreview] = useState<ParsedImport | null>(null)

  const loadAll = async (): Promise<Backup> => {
    const [s, ex, plans, workouts, body, habits] = await Promise.all([
      backend.get<Settings>('settings', 'app'),
      backend.list<Exercise>('exercises'),
      backend.list<Plan>('plans'),
      backend.list<Workout>('workouts', { order: 'asc' }),
      backend.list<BodyLog>('bodyLogs', { order: 'asc' }),
      backend.list<HabitLog>('habitLogs', { order: 'asc' }),
    ])
    return { app: 'overload', version: 1, exportedAt: new Date().toISOString(), settings: s, exercises: ex, plans, workouts, bodyLogs: body, habitLogs: habits }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const exportJSON = () =>
    run(async () => {
      const data = await loadAll()
      downloadFile(`overload-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')
    })

  const exportCSV = () =>
    run(async () => {
      const data = await loadAll()
      const u = settings.weightUnit
      const names = new Map(data.exercises.map((e) => [e.id, e]))
      const rows: (string | number | null)[][] = [['Date', 'Session', 'Exercise', 'Muscle', 'Set', `Weight (${u})`, 'Reps', 'Drop', 'Notes']]
      for (const w of data.workouts)
        for (const e of w.entries) {
          let n = 0
          for (const s of e.sets) {
            if (!s.done) continue
            n++
            rows.push([w.date, w.title, names.get(e.exerciseId)?.name ?? e.exerciseId, names.get(e.exerciseId)?.muscle ?? '', n, s.weight != null ? fmtNum(kgTo(s.weight, u), 2) : '', s.reps, s.drop ? 'yes' : '', n === 1 ? e.notes : ''])
          }
        }
      downloadFile(`overload-workouts-${todayISO()}.csv`, toCSV(rows), 'text/csv')

      const lu = settings.lengthUnit
      const body = [['Date', `Weight (${u})`, `Waist (${lu})`], ...data.bodyLogs.map((b) => [b.date, b.weightKg != null ? fmtNum(kgTo(b.weightKg, u), 2) : '', b.waistIn != null ? fmtNum(inTo(b.waistIn, lu), 2) : ''])]
      downloadFile(`overload-body-${todayISO()}.csv`, toCSV(body), 'text/csv')

      const habits = [['Date', 'Meals', 'Protein meals', 'Workout done', 'Energy'], ...data.habitLogs.map((h) => [h.date, h.meals, h.proteinMeals, h.workoutDone ? 'yes' : 'no', h.energy])]
      downloadFile(`overload-habits-${todayISO()}.csv`, toCSV(habits), 'text/csv')
    })

  const importJSON = (file: File) =>
    run(async () => {
      let data: Partial<Backup>
      try {
        data = JSON.parse(await file.text())
      } catch {
        throw new Error('That file isn’t valid JSON.')
      }
      if (data.app !== 'overload') throw new Error('Not an Overload backup file.')
      const counts = `${data.workouts?.length ?? 0} workouts, ${data.exercises?.length ?? 0} exercises, ${data.plans?.length ?? 0} plans, ${data.bodyLogs?.length ?? 0} body logs, ${data.habitLogs?.length ?? 0} habit logs`
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `${counts}. Items with the same id are replaced; everything else you have is kept.`,
        confirmLabel: 'Restore',
      })
      if (!ok) return
      const items: WriteItem[] = []
      const add = (col: CollectionName, list?: { id: string }[]) => list?.forEach((d) => d?.id && items.push({ col, id: d.id, data: d }))
      add('exercises', data.exercises)
      add('plans', data.plans)
      add('workouts', data.workouts)
      add('bodyLogs', data.bodyLogs)
      add('habitLogs', data.habitLogs)
      if (data.settings) items.push({ col: 'settings', id: 'app', data: { ...data.settings, id: undefined } })
      await backend.putMany(items)
      toast(`Restored ${items.length} items`)
    })

  const readCSV = (file: File) =>
    run(async () => {
      const text = await file.text()
      setPreview(parseImportCsv(text, { dateOrder, weightUnit: csvUnit, lengthUnit: settings.lengthUnit }))
    })

  const byName = new Map(exercises.map((e) => [e.name.trim().toLowerCase(), e]))
  const newNames =
    preview?.kind === 'workouts' ? [...new Set(preview.workouts.flatMap((w) => w.entries.map((e) => e.exerciseName.trim())))].filter((n) => !byName.has(n.toLowerCase())) : []

  const commitCSV = () =>
    run(async () => {
      if (!preview || preview.kind === 'unknown') return
      const items: WriteItem[] = []
      if (preview.kind === 'workouts') {
        const ids = new Map<string, string>()
        for (const [k, e] of byName) ids.set(k, e.id)
        for (const name of newNames) {
          const id = exMap.has(slugId(name)) ? newId() : slugId(name) || newId()
          ids.set(name.toLowerCase(), id)
          items.push({ col: 'exercises', id, data: { id, name, muscle: 'Other', equipment: 'Other', notes: 'Imported', createdAt: Date.now() } })
        }
        for (const pw of preview.workouts) {
          // Deterministic id: importing the same file twice replaces rather than duplicates.
          const id = `imp-${pw.date}-${slugId(pw.title).slice(0, 40)}`
          const t = fromISODate(pw.date).getTime() + 12 * 3600_000
          const w: Workout = {
            id,
            date: pw.date,
            startedAt: t,
            finishedAt: t,
            title: pw.title,
            notes: '',
            entries: pw.entries.map((e) => ({ id: newId(), exerciseId: ids.get(e.exerciseName.trim().toLowerCase())!, notes: e.notes, sets: e.sets, target: null })),
          }
          items.push({ col: 'workouts', id, data: w })
        }
      } else {
        for (const b of preview.bodyLogs) {
          const cur = bodyLogs.find((x) => x.date === b.date)
          items.push({ col: 'bodyLogs', id: b.date, data: { id: b.date, date: b.date, weightKg: b.weightKg ?? cur?.weightKg ?? null, waistIn: b.waistIn ?? cur?.waistIn ?? null } })
        }
      }
      await backend.putMany(items)
      toast(`Imported ${preview.kind === 'workouts' ? preview.workouts.length + ' workouts' : preview.bodyLogs.length + ' measurements'}`)
      setPreview(null)
    })

  return (
    <>
      <PageHeader title="Backup & import" back={() => navigate(-1)} />

      <SectionTitle>Export</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">A full JSON backup restores everything. CSV files open in Excel / Google Sheets (workouts, body and habits).</p>
        <div className="grid grid-cols-2 gap-2">
          <Button icon="download" disabled={busy} onClick={exportJSON}>
            JSON backup
          </Button>
          <Button icon="download" variant="secondary" disabled={busy} onClick={exportCSV}>
            CSV files
          </Button>
        </div>
      </Card>

      <SectionTitle>Restore from JSON</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">Restores an Overload backup. Existing items are kept unless the backup has the same item.</p>
        <input ref={jsonInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0]).finally(() => (e.target.value = ''))} />
        <Button variant="secondary" icon="upload" block disabled={busy} onClick={() => jsonInput.current?.click()}>
          Choose backup file
        </Button>
      </Card>

      <SectionTitle>Import past logs from CSV</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Export your spreadsheet as CSV. Needs a <b>Date</b> and <b>Exercise</b> column, plus either <b>Weight</b> + <b>Reps</b> (one row per set), a <b>Sets</b> column like
          “60x10, 60x9”, or <b>Set 1 / Set 2…</b> columns. Blank date/exercise cells reuse the row above. A file with Date + Weight/Waist (no exercise) imports body measurements.
        </p>
        <Field label="Date format in the file">
          <Segmented value={dateOrder} onChange={setDateOrder} options={[{ value: 'dmy', label: 'Day/Month/Year' }, { value: 'mdy', label: 'Month/Day/Year' }]} />
        </Field>
        <Field label="Weights in the file are in" hint="Ignored if the column header says kg or lb">
          <Segmented value={csvUnit} onChange={setCsvUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Field>
        <input ref={csvInput} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && readCSV(e.target.files[0]).finally(() => (e.target.value = ''))} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon="upload" disabled={busy} onClick={() => csvInput.current?.click()}>
            Choose CSV
          </Button>
          <Button variant="ghost" icon="download" onClick={() => downloadFile('overload-import-template.csv', CSV_TEMPLATE, 'text/csv')}>
            Template
          </Button>
        </div>

        {preview && (
          <div className="rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
            {preview.kind === 'unknown' ? (
              <p className="text-red-600 dark:text-red-400">{preview.errors[0]}</p>
            ) : (
              <>
                <p className="font-medium">
                  {preview.kind === 'workouts'
                    ? `${preview.workouts.length} workouts · ${preview.workouts.reduce((n, w) => n + w.entries.reduce((m, e) => m + e.sets.length, 0), 0)} sets`
                    : `${preview.bodyLogs.length} body measurements`}
                  {preview.kind === 'workouts' && preview.workouts.length > 0 && ` · ${preview.workouts[0].date} → ${preview.workouts[preview.workouts.length - 1].date}`}
                </p>
                {newNames.length > 0 && (
                  <p className="mt-1 text-ink-600 dark:text-ink-300">
                    New exercises will be created (muscle “Other”, edit later): {newNames.slice(0, 12).join(', ')}
                    {newNames.length > 12 ? ` +${newNames.length - 12} more` : ''}
                  </p>
                )}
                {preview.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-amber-700 dark:text-amber-300">{preview.errors.length} rows skipped</summary>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {preview.errors.slice(0, 20).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy || (preview.kind === 'workouts' ? !preview.workouts.length : !preview.bodyLogs.length)} onClick={commitCSV}>
                    Import
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  )
}
