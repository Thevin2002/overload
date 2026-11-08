import { useState } from 'react'
import { authErrorMessage, firebaseConfigured, useAuth } from '../data/AuthContext'
import { Button, Field, Segmented, TextInput } from '../components/ui'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { signInGoogle, signInEmail, signUpEmail, resetPassword, startDemo } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Overload</h1>
        <p className="mt-1 text-ink-500 dark:text-ink-400">Plan it. Log it. Beat last time.</p>
      </div>

      {!firebaseConfigured ? (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          <p className="font-medium">Firebase isn’t configured yet.</p>
          <p className="mt-1">
            Add your <code>VITE_FIREBASE_*</code> values to <code>.env.local</code> (local) or the GitHub repository secrets (deploy). See the README.
            You can still try the app in demo mode — data stays on this device.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Button block size="lg" variant="secondary" disabled={busy} onClick={() => run(signInGoogle)}>
            <GoogleMark /> Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-ink-400">
            <div className="h-px flex-1 bg-ink-200 dark:bg-ink-800" /> or use email <div className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
          </div>

          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => (mode === 'signin' ? signInEmail(email.trim(), password) : signUpEmail(email.trim(), password)))
            }}
          >
            <Field label="Email">
              <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
              <TextInput
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" block size="lg" disabled={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {mode === 'signin' && (
            <button
              type="button"
              className="w-full py-2 text-center text-sm text-ink-500 underline-offset-2 hover:underline"
              onClick={() => {
                if (!email.trim()) return setError('Enter your email above first.')
                run(async () => {
                  await resetPassword(email.trim())
                  setInfo('Password reset email sent.')
                })
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {info && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-700/20 dark:text-brand-300">{info}</p>}

      <button type="button" onClick={startDemo} className="mt-8 py-2 text-center text-sm text-ink-500 underline-offset-2 hover:underline">
        Try it without an account (demo, this device only)
      </button>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
