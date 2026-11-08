import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BodyLog, Exercise, HabitLog, Plan, Settings, Workout } from '../types'
import { createFirestoreBackend, createLocalBackend, type Backend, type RangeQuery } from './backend'
import { defaultSettings, seedExercises, seedPlan } from './seed'
import { useAuth } from './AuthContext'
import { addDays, todayISO } from '../lib/dates'

/** How far back the always-on listeners look. Older data is fetched on demand by date range. */
export const RECENT_WORKOUT_DAYS = 180
const RECENT_HABIT_DAYS = 120

interface DataValue {
  backend: Backend
  ready: boolean
  needsOnlineSetup: boolean
  settings: Settings
  exercises: Exercise[]
  exMap: Map<string, Exercise>
  plans: Plan[]
  activePlan: Plan | null
  /** Workouts from the last RECENT_WORKOUT_DAYS days, newest first. */
  workouts: Workout[]
  bodyLogs: BodyLog[]
  habitLogs: HabitLog[]
  updateSettings(patch: Partial<Settings>): void
  saveExercise(ex: Exercise): void
  deleteExercise(id: string): void
  savePlan(plan: Plan): void
  deletePlan(id: string): void
  saveWorkout(w: Workout): void
  deleteWorkout(id: string): void
  saveBodyLog(log: BodyLog): void
  deleteBodyLog(id: string): void
  saveHabit(date: string, patch: Partial<HabitLog>): void
  loadWorkouts(q: RangeQuery): Promise<Workout[]>
  /** Workouts older than the recent window, fetched once per app session on demand (null = not loaded). */
  archive: Workout[] | null
  ensureArchive(): void
  /** recent + archive (whatever is loaded), newest first */
  allWorkouts: Workout[]
  resetToSeedPlan(): void
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user!.uid
  const demo = user!.demo
  const backend = useMemo(() => (demo ? createLocalBackend('demo') : createFirestoreBackend(uid)), [uid, demo])

  const [rawSettings, setRawSettings] = useState<Partial<Settings> | null | undefined>(undefined)
  const [needsOnlineSetup, setNeedsOnlineSetup] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [archive, setArchive] = useState<Workout[] | null>(null)
  const archiveRequested = useRef(false)

  const ensureArchive = useCallback(() => {
    if (archiveRequested.current) return
    archiveRequested.current = true
    backend
      .list<Workout>('workouts', { to: addDays(todayISO(), -RECENT_WORKOUT_DAYS - 1), order: 'desc' })
      .then((docs) => setArchive(sortWorkouts(docs)))
      .catch(() => {
        archiveRequested.current = false // offline: try again later
      })
  }, [backend])

  const allWorkouts = useMemo(() => (archive?.length ? sortWorkouts([...workouts, ...archive.filter((a) => !workouts.some((w) => w.id === a.id))]) : workouts), [workouts, archive])

  // First login: seed the default plan, exercises and settings — but only after the server
  // confirms there is no settings doc, so a fresh offline device never overwrites real data.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const exists = await backend.existsOnServer('settings', 'app')
        if (cancelled || exists) return
        const now = Date.now()
        await backend.putMany([
          ...seedExercises(now).map((e) => ({ col: 'exercises' as const, id: e.id, data: e })),
          { col: 'plans', id: seedPlan(now).id, data: seedPlan(now) },
          { col: 'settings', id: 'app', data: defaultSettings(now) },
        ])
      } catch {
        // Offline on a device that has never synced: the settings listener below decides what to show.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backend])

  useEffect(() => {
    const today = todayISO()
    const unsubs = [
      backend.watchDoc<Settings>('settings', 'app', (doc, fromCache) => {
        if (doc) {
          setRawSettings(doc)
          setNeedsOnlineSetup(false)
        } else if (fromCache) {
          setNeedsOnlineSetup(!navigator.onLine)
        } else {
          setRawSettings(null)
        }
      }),
      backend.watchCol<Exercise>('exercises', null, (docs) =>
        setExercises(docs.sort((a, b) => a.name.localeCompare(b.name))),
      ),
      backend.watchCol<Plan>('plans', null, (docs) => setPlans(docs.sort((a, b) => a.createdAt - b.createdAt))),
      backend.watchCol<Workout>('workouts', { from: addDays(today, -RECENT_WORKOUT_DAYS), order: 'desc' }, (docs) =>
        setWorkouts(sortWorkouts(docs)),
      ),
      backend.watchCol<BodyLog>('bodyLogs', { order: 'asc' }, setBodyLogs),
      backend.watchCol<HabitLog>('habitLogs', { from: addDays(today, -RECENT_HABIT_DAYS), order: 'asc' }, setHabitLogs),
    ]
    return () => unsubs.forEach((u) => u())
  }, [backend])

  const settings = useMemo<Settings>(() => ({ ...defaultSettings(0), ...(rawSettings || {}) }), [rawSettings])

  // Theme
  useEffect(() => {
    try {
      localStorage.setItem('overload:theme', settings.theme)
    } catch {}
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c1117' : '#f6f7f9')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme])

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const activePlan = useMemo(
    () => plans.find((p) => p.id === settings.activePlanId) ?? plans[0] ?? null,
    [plans, settings.activePlanId],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => backend.patch('settings', 'app', patch), [backend])

  const value = useMemo<DataValue>(
    () => ({
      backend,
      ready: rawSettings !== undefined && rawSettings !== null,
      needsOnlineSetup,
      settings,
      exercises,
      exMap,
      plans,
      activePlan,
      workouts,
      bodyLogs,
      habitLogs,
      updateSettings,
      saveExercise: (ex) => backend.put('exercises', ex.id, ex),
      deleteExercise: (id) => backend.remove('exercises', id),
      savePlan: (plan) => backend.put('plans', plan.id, { ...plan, updatedAt: Date.now() }),
      deletePlan: (id) => backend.remove('plans', id),
      saveWorkout: (w) => backend.put('workouts', w.id, w),
      deleteWorkout: (id) => backend.remove('workouts', id),
      saveBodyLog: (log) => backend.put('bodyLogs', log.id, log),
      deleteBodyLog: (id) => backend.remove('bodyLogs', id),
      saveHabit: (date, patch) => backend.patch('habitLogs', date, { ...patch, id: date, date }),
      loadWorkouts: async (q) => sortWorkouts(await backend.list<Workout>('workouts', q)),
      archive,
      ensureArchive,
      allWorkouts,
      resetToSeedPlan: () => {
        const now = Date.now()
        const plan = seedPlan(now)
        // Make sure every seed exercise exists (users may have deleted some).
        const missing = seedExercises(now).filter((e) => !exMap.has(e.id))
        backend.putMany([
          ...missing.map((e) => ({ col: 'exercises' as const, id: e.id, data: e })),
          { col: 'plans', id: plan.id, data: plan },
        ])
        updateSettings({ activePlanId: plan.id })
      },
    }),
    [backend, rawSettings, needsOnlineSetup, settings, exercises, exMap, plans, activePlan, workouts, bodyLogs, habitLogs, updateSettings, archive, ensureArchive, allWorkouts],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function sortWorkouts(list: Workout[]): Workout[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1))
}

export function useData() {
  const v = useContext(DataContext)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}
