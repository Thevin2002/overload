import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { formatClock } from '../lib/dates'

interface TimerState {
  endAt: number
  duration: number
  label: string
}

interface TimerValue {
  state: TimerState | null
  remaining: number
  start(sec: number, label?: string): void
  add(sec: number): void
  stop(): void
}

const Ctx = createContext<TimerValue | null>(null)
const KEY = 'overload:rest-timer'

/** Timestamp-based so it stays correct when the phone sleeps or the tab is backgrounded. */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null') as TimerState | null
      return s && s.endAt > Date.now() ? s : null
    } catch {
      return null
    }
  })
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)

  useEffect(() => {
    try {
      if (state) localStorage.setItem(KEY, JSON.stringify(state))
      else localStorage.removeItem(KEY)
    } catch {}
  }, [state])

  useEffect(() => {
    if (!state) return
    fired.current = false
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [state])

  const remaining = state ? Math.max(0, (state.endAt - now) / 1000) : 0

  useEffect(() => {
    if (state && remaining <= 0 && !fired.current) {
      fired.current = true
      alertDone()
      const t = window.setTimeout(() => setState(null), 1500)
      return () => window.clearTimeout(t)
    }
  }, [state, remaining])

  const start = useCallback((sec: number, label = 'Rest') => {
    primeAudio()
    setNow(Date.now())
    setState({ endAt: Date.now() + sec * 1000, duration: sec, label })
  }, [])
  const add = useCallback(
    (sec: number) =>
      setState((s) => {
        if (!s) return s
        const endAt = Math.max(Date.now() + 1000, s.endAt + sec * 1000)
        return { ...s, endAt, duration: Math.max(1, s.duration + sec) }
      }),
    [],
  )
  const stop = useCallback(() => setState(null), [])

  const value = useMemo(() => ({ state, remaining, start, add, stop }), [state, remaining, start, add, stop])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRestTimer() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRestTimer outside provider')
  return v
}

/** Floating bar shown while a rest is running. */
export function RestTimerBar({ bottomOffset = 16 }: { bottomOffset?: number }) {
  const { state, remaining, add, stop } = useRestTimer()
  if (!state) return null
  const pct = Math.min(100, Math.max(0, (1 - remaining / state.duration) * 100))
  const done = remaining <= 0
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3" style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}>
      <div
        className={`pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-2xl shadow-xl ring-1 ${
          done ? 'bg-brand-500 text-white ring-brand-600' : 'bg-ink-900 text-white ring-ink-700 dark:bg-ink-800'
        }`}
        role="timer"
        aria-live="polite"
      >
        <div className="absolute inset-y-0 left-0 bg-white/10 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        <div className="relative flex items-center gap-1 p-2">
          <Icon name="timer" size={20} className="ml-2 opacity-80" />
          <div className="ml-1 min-w-0 flex-1">
            <div className="text-xs opacity-70">{done ? 'Rest done — go!' : state.label}</div>
            <div className="text-2xl leading-tight font-semibold tabular-nums">{formatClock(remaining)}</div>
          </div>
          <button type="button" onClick={() => add(-15)} className="h-11 rounded-xl px-3 text-sm font-medium hover:bg-white/10" aria-label="Subtract 15 seconds">
            −15
          </button>
          <button type="button" onClick={() => add(15)} className="h-11 rounded-xl px-3 text-sm font-medium hover:bg-white/10" aria-label="Add 15 seconds">
            +15
          </button>
          <button type="button" onClick={stop} className="h-11 rounded-xl px-3 text-sm font-medium hover:bg-white/10">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

let audioCtx: AudioContext | null = null
/** Audio must be unlocked by a user gesture on iOS — called when a timer starts. */
function primeAudio() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {}
}

function alertDone() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {}
  try {
    if (!audioCtx) return
    const t = audioCtx.currentTime
    ;[0, 0.22].forEach((offset) => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, t + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18)
      osc.connect(gain).connect(audioCtx!.destination)
      osc.start(t + offset)
      osc.stop(t + offset + 0.2)
    })
  } catch {}
}
