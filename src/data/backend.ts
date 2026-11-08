import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { CollectionName } from '../types'

export interface RangeQuery {
  /** inclusive YYYY-MM-DD lower bound on `date` */
  from?: string
  /** inclusive YYYY-MM-DD upper bound on `date` */
  to?: string
  order?: 'asc' | 'desc'
  limit?: number
}

export type Unsub = () => void
export type WriteItem = { col: CollectionName; id: string; data: object }

/**
 * Storage abstraction. Writes are fire-and-forget: with Firestore offline persistence the local
 * cache (and all listeners) update instantly, and the server write completes whenever we're online.
 * Write errors are reported through `onWriteError`.
 */
export interface Backend {
  kind: 'firestore' | 'local'
  watchCol<T>(col: CollectionName, q: RangeQuery | null, cb: (docs: T[]) => void, onError?: (e: Error) => void): Unsub
  watchDoc<T>(col: CollectionName, id: string, cb: (doc: T | null, fromCache: boolean) => void): Unsub
  list<T>(col: CollectionName, q?: RangeQuery | null): Promise<T[]>
  get<T>(col: CollectionName, id: string): Promise<T | null>
  /** Checks the server (throws when offline) — used before seeding so we never overwrite real data. */
  existsOnServer(col: CollectionName, id: string): Promise<boolean>
  put(col: CollectionName, id: string, data: object): void
  patch(col: CollectionName, id: string, data: object): void
  remove(col: CollectionName, id: string): void
  putMany(items: WriteItem[]): Promise<void>
}

type ErrorListener = (e: Error) => void
const errorListeners = new Set<ErrorListener>()
export function onWriteError(fn: ErrorListener): Unsub {
  errorListeners.add(fn)
  return () => errorListeners.delete(fn)
}
function reportWriteError(e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e))
  console.error('[write failed]', err)
  errorListeners.forEach((fn) => fn(err))
}

/** Firestore rejects `undefined`; JSON round-trip also drops functions and prototypes. */
function clean<T extends object>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

export function createFirestoreBackend(uid: string): Backend {
  if (!db) throw new Error('Firestore is not configured')
  const fs = db
  const colRef = (col: CollectionName) => collection(fs, 'users', uid, col)
  const docRef = (col: CollectionName, id: string) => doc(fs, 'users', uid, col, id)

  const buildQuery = (col: CollectionName, q: RangeQuery | null | undefined) => {
    const c: QueryConstraint[] = []
    if (q?.from) c.push(where('date', '>=', q.from))
    if (q?.to) c.push(where('date', '<=', q.to))
    if (q?.from || q?.to || q?.order) c.push(orderBy('date', q?.order ?? 'asc'))
    if (q?.limit) c.push(fsLimit(q.limit))
    return query(colRef(col), ...c)
  }

  return {
    kind: 'firestore',
    watchCol(col, q, cb, onError) {
      return onSnapshot(
        buildQuery(col, q),
        (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as never)),
        (e) => {
          console.error(`[watch ${col}]`, e)
          onError?.(e)
        },
      )
    },
    watchDoc(col, id, cb) {
      return onSnapshot(
        docRef(col, id),
        (snap) => cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as never) : null, snap.metadata.fromCache),
        (e) => console.error(`[watch ${col}/${id}]`, e),
      )
    },
    async list(col, q) {
      const snap = await getDocs(buildQuery(col, q))
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as never)
    },
    async get(col, id) {
      const snap = await getDoc(docRef(col, id))
      return snap.exists() ? ({ ...snap.data(), id: snap.id } as never) : null
    },
    async existsOnServer(col, id) {
      const snap = await getDocFromServer(docRef(col, id))
      return snap.exists()
    },
    put(col, id, data) {
      setDoc(docRef(col, id), clean(data)).catch(reportWriteError)
    },
    patch(col, id, data) {
      setDoc(docRef(col, id), clean(data), { merge: true }).catch(reportWriteError)
    },
    remove(col, id) {
      deleteDoc(docRef(col, id)).catch(reportWriteError)
    },
    async putMany(items) {
      // Firestore batches are limited to 500 writes.
      for (let i = 0; i < items.length; i += 450) {
        const batch = writeBatch(fs)
        for (const it of items.slice(i, i + 450)) batch.set(docRef(it.col, it.id), clean(it.data))
        // Don't await the server: offline commits resolve only after reconnecting.
        batch.commit().catch(reportWriteError)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Local (demo mode) — same API, stored in localStorage on this device only.
// ---------------------------------------------------------------------------

export function createLocalBackend(namespace = 'demo'): Backend {
  const key = (col: CollectionName) => `overload:${namespace}:${col}`
  const listeners = new Map<CollectionName, Set<() => void>>()

  const read = (col: CollectionName): Record<string, Record<string, unknown>> => {
    try {
      return JSON.parse(localStorage.getItem(key(col)) || '{}')
    } catch {
      return {}
    }
  }
  const write = (col: CollectionName, data: Record<string, unknown>) => {
    try {
      localStorage.setItem(key(col), JSON.stringify(data))
    } catch (e) {
      reportWriteError(e)
    }
    queueMicrotask(() => listeners.get(col)?.forEach((fn) => fn()))
  }
  const runQuery = (col: CollectionName, q: RangeQuery | null | undefined) => {
    let docs = Object.entries(read(col)).map(([id, d]) => ({ ...d, id }) as Record<string, unknown> & { id: string })
    if (q?.from) docs = docs.filter((d) => String(d.date) >= q.from!)
    if (q?.to) docs = docs.filter((d) => String(d.date) <= q.to!)
    if (q?.from || q?.to || q?.order) {
      const dir = q?.order === 'desc' ? -1 : 1
      docs.sort((a, b) => (String(a.date) < String(b.date) ? -dir : String(a.date) > String(b.date) ? dir : 0))
    }
    if (q?.limit) docs = docs.slice(0, q.limit)
    return docs
  }
  const subscribe = (col: CollectionName, fn: () => void): Unsub => {
    if (!listeners.has(col)) listeners.set(col, new Set())
    listeners.get(col)!.add(fn)
    queueMicrotask(fn)
    return () => listeners.get(col)?.delete(fn)
  }

  return {
    kind: 'local',
    watchCol(col, q, cb) {
      return subscribe(col, () => cb(runQuery(col, q) as never))
    },
    watchDoc(col, id, cb) {
      return subscribe(col, () => {
        const d = read(col)[id]
        cb(d ? ({ ...d, id } as never) : null, false)
      })
    },
    async list(col, q) {
      return runQuery(col, q) as never
    },
    async get(col, id) {
      const d = read(col)[id]
      return d ? ({ ...d, id } as never) : null
    },
    async existsOnServer(col, id) {
      return Boolean(read(col)[id])
    },
    put(col, id, data) {
      const all = read(col)
      all[id] = clean(data) as Record<string, unknown>
      write(col, all)
    },
    patch(col, id, data) {
      const all = read(col)
      all[id] = { ...(all[id] || {}), ...(clean(data) as Record<string, unknown>) }
      write(col, all)
    },
    remove(col, id) {
      const all = read(col)
      delete all[id]
      write(col, all)
    },
    async putMany(items) {
      const byCol = new Map<CollectionName, WriteItem[]>()
      for (const it of items) byCol.set(it.col, [...(byCol.get(it.col) || []), it])
      for (const [col, list] of byCol) {
        const all = read(col)
        for (const it of list) all[it.id] = clean(it.data) as Record<string, unknown>
        write(col, all)
      }
    },
  }
}

export function clearLocalBackend(namespace = 'demo') {
  const prefix = `overload:${namespace}:`
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => localStorage.removeItem(k))
}
