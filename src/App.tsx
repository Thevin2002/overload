import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/AuthContext'
import { DataProvider, useData } from './data/DataContext'
import { FeedbackProvider } from './components/Feedback'
import { RestTimerProvider } from './components/RestTimer'
import { Layout } from './components/Layout'
import { Logo } from './components/Logo'
import { LoginPage } from './pages/LoginPage'
import { TodayPage } from './pages/TodayPage'
import { LogPage } from './pages/LogPage'
import { PlanPage } from './pages/PlanPage'
import { DayEditorPage } from './pages/DayEditorPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { BodyPage } from './pages/BodyPage'
import { HabitsPage } from './pages/HabitsPage'
import { HistoryPage } from './pages/HistoryPage'
import { MorePage } from './pages/MorePage'
import { SettingsPage } from './pages/SettingsPage'
import { DataPage } from './pages/DataPage'

// Charts (Recharts) are the heaviest dependency — load them only when needed.
const ProgressPage = lazy(() => import('./pages/ProgressPage'))

export default function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <Gate />
      </FeedbackProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <LoginPage />
  return (
    <DataProvider key={user.uid}>
      <RestTimerProvider>
        <Ready />
      </RestTimerProvider>
    </DataProvider>
  )
}

function Ready() {
  const { ready, needsOnlineSetup } = useData()
  if (needsOnlineSetup)
    return (
      <Splash>
        <p className="mt-4 max-w-xs text-center text-sm text-ink-500">
          Connect to the internet once so Overload can set up your account. After that it works offline.
        </p>
      </Splash>
    )
  if (!ready) return <Splash />
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="log/:id" element={<LogPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="plan/:planId/day/:dayId" element={<DayEditorPage />} />
          <Route path="plan/:planId/abs" element={<DayEditorPage abs />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route
            path="progress"
            element={
              <Suspense fallback={<p className="py-10 text-center text-ink-500">Loading charts…</p>}>
                <ProgressPage />
              </Suspense>
            }
          />
          <Route path="body" element={<BodyPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <Logo />
      {children ?? <div className="mt-6 h-1 w-24 animate-pulse rounded-full bg-ink-200 dark:bg-ink-800" />}
    </div>
  )
}
