import { Component, type ReactNode } from 'react'

/** Last-resort screen so a render error never leaves a blank page mid-workout. Data is already saved. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500">Your logged sets are saved. Reload to continue.</p>
        <pre className="mt-4 max-w-full overflow-auto rounded-xl bg-ink-100 p-3 text-left text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">{this.state.error.message}</pre>
        <button type="button" onClick={() => location.reload()} className="mt-6 h-11 rounded-xl bg-brand-500 px-5 font-medium text-white">
          Reload
        </button>
      </div>
    )
  }
}
