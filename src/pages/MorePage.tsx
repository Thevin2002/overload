import { useNavigate } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'
import { useAuth } from '../data/AuthContext'

const ITEMS: { to: string; icon: IconName; title: string; sub: string }[] = [
  { to: '/habits', icon: 'heart', title: 'Habits', sub: 'Meals, protein, energy — weekly summary' },
  { to: '/history', icon: 'history', title: 'Workout history', sub: 'Every session, editable' },
  { to: '/exercises', icon: 'dumbbell', title: 'Exercise library', sub: 'Search, add and edit exercises' },
  { to: '/settings', icon: 'settings', title: 'Settings', sub: 'Units, theme, rest timer, progression' },
  { to: '/data', icon: 'download', title: 'Backup & import', sub: 'Export JSON / CSV, import past logs' },
]

export function MorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <>
      <PageHeader title="More" subtitle={user?.demo ? 'Demo mode' : user?.email ?? undefined} />
      <div className="space-y-2">
        {ITEMS.map((it) => (
          <Card key={it.to} onClick={() => navigate(it.to)} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
              <Icon name={it.icon} />
            </div>
            <div className="flex-1">
              <div className="font-medium">{it.title}</div>
              <div className="text-sm text-ink-500">{it.sub}</div>
            </div>
            <Icon name="chevronRight" size={18} className="text-ink-400" />
          </Card>
        ))}
      </div>
    </>
  )
}
