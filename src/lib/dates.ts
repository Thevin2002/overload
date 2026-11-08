export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function weekdayOf(iso: string): number {
  return fromISODate(iso).getDay()
}

/** First day of the week containing `iso`. weekStartsOn: 0 = Sunday, 1 = Monday. */
export function startOfWeek(iso: string, weekStartsOn: 0 | 1 = 1): string {
  const wd = weekdayOf(iso)
  const diff = (wd - weekStartsOn + 7) % 7
  return addDays(iso, -diff)
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return fromISODate(iso).toLocaleDateString(undefined, opts)
}

export function formatLongDate(iso: string): string {
  return formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h ? `${h}h ${m}m` : `${m} min`
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}
