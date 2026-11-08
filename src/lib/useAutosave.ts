import { useEffect, useRef } from 'react'

/**
 * Debounced save of a local draft. Skips the first (initial) value, and flushes any pending
 * change when the component unmounts or the page is hidden (app switched / screen locked).
 */
export function useAutosave<T>(value: T | null, save: (v: T) => void, delay = 600) {
  const saveRef = useRef(save)
  saveRef.current = save
  const initialised = useRef(false)
  const pending = useRef<T | null>(null)

  useEffect(() => {
    if (value == null) return
    if (!initialised.current) {
      initialised.current = true
      return
    }
    pending.current = value
    const t = window.setTimeout(() => {
      if (pending.current != null) saveRef.current(pending.current)
      pending.current = null
    }, delay)
    return () => window.clearTimeout(t)
  }, [value, delay])

  useEffect(() => {
    const flush = () => {
      if (pending.current != null) {
        saveRef.current(pending.current)
        pending.current = null
      }
    }
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return {
    /** Drop any pending (unsaved) change — use before deleting the thing being edited. */
    cancel: () => {
      pending.current = null
    },
  }
}
