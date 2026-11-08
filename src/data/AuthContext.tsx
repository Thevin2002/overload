import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '../firebase'

export interface AppUser {
  uid: string
  email: string | null
  name: string | null
  demo: boolean
}

interface AuthValue {
  user: AppUser | null
  loading: boolean
  signInGoogle(): Promise<void>
  signInEmail(email: string, password: string): Promise<void>
  signUpEmail(email: string, password: string): Promise<void>
  resetPassword(email: string): Promise<void>
  startDemo(): void
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const DEMO_KEY = 'overload:demo-active'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(DEMO_KEY) === '1') {
      setUser({ uid: 'demo', email: null, name: 'Demo', demo: true })
      setLoading(false)
      return
    }
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, email: u.email, name: u.displayName, demo: false } : null)
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      async signInGoogle() {
        if (!auth) throw new Error('Firebase is not configured')
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        try {
          await signInWithPopup(auth, provider)
        } catch (e) {
          const code = (e as { code?: string }).code
          // Popups are blocked in some installed-PWA contexts — fall back to a full redirect.
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider)
          } else throw e
        }
      },
      async signInEmail(email, password) {
        if (!auth) throw new Error('Firebase is not configured')
        await signInWithEmailAndPassword(auth, email, password)
      },
      async signUpEmail(email, password) {
        if (!auth) throw new Error('Firebase is not configured')
        await createUserWithEmailAndPassword(auth, email, password)
      },
      async resetPassword(email) {
        if (!auth) throw new Error('Firebase is not configured')
        await sendPasswordResetEmail(auth, email)
      },
      startDemo() {
        localStorage.setItem(DEMO_KEY, '1')
        setUser({ uid: 'demo', email: null, name: 'Demo', demo: true })
      },
      async signOut() {
        if (user?.demo) {
          localStorage.removeItem(DEMO_KEY)
          setUser(null)
          return
        }
        if (auth) await fbSignOut(auth)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}

export { firebaseConfigured }

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account with that email.',
    'auth/email-already-in-use': 'An account with that email already exists — sign in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'No connection. Sign-in needs internet the first time.',
    'auth/unauthorized-domain': 'This domain is not authorised in Firebase Auth → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Auth.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  }
  return map[code] || (e instanceof Error ? e.message : 'Something went wrong.')
}
