import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { RestTimerBar } from './RestTimer'
import { cx } from './ui'
import { useOnline } from '../lib/useOnline'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'home' },
  { to: '/plan', label: 'Plan', icon: 'calendar' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/body', label: 'Body', icon: 'scale' },
  { to: '/more', label: 'More', icon: 'more' },
]

export function Layout() {
  const online = useOnline()
  const { pathname } = useLocation()
  const fullScreen = pathname.startsWith('/log/')

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {!online && (
        <div className="pt-safe sticky top-0 z-30 bg-amber-500 px-4 py-1 text-center text-xs font-medium text-amber-950">
          Offline — changes are saved on this device and will sync later
        </div>
      )}
      <main className={cx('px-4', fullScreen ? 'pb-40' : 'pb-32')}>
        <Outlet />
      </main>
      <RestTimerBar bottomOffset={fullScreen ? 16 : 84} />
      {!fullScreen && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/80 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
          <div className="mx-auto flex max-w-lg">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-500 dark:text-ink-400',
                  )
                }
              >
                <Icon name={t.icon} size={22} />
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
