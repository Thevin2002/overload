import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Sheet } from './ui'
import { onWriteError } from '../data/backend'

interface ConfirmOpts {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackValue {
  confirm(opts: ConfirmOpts): Promise<boolean>
  toast(message: string): void
}

const Ctx = createContext<FeedbackValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timer = useRef<number>(undefined)

  const toast = useCallback((message: string) => {
    setToastMsg(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })), [])

  useEffect(
    () =>
      onWriteError((e) => {
        const permission = /permission|insufficient/i.test(e.message)
        toast(permission ? 'Save blocked by security rules — check firestore.rules.' : `Couldn't save: ${e.message}`)
      }),
    [toast],
  )

  const close = (v: boolean) => {
    dialog?.resolve(v)
    setDialog(null)
  }

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      <Sheet
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} block onClick={() => close(true)}>
              {dialog?.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        }
      >
        {dialog?.message && <div className="text-ink-600 dark:text-ink-300">{dialog.message}</div>}
      </Sheet>
      {toastMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4" role="status">
          <div className="animate-sheet rounded-xl bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-ink-100 dark:text-ink-900">{toastMsg}</div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useFeedback() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFeedback outside FeedbackProvider')
  return v
}
