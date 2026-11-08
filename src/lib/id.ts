const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Short random id (12 chars, ~62 bits). Good enough for per-user documents. */
export function newId(len = 12): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/** Stable slug id, used for seed data so seeding twice is harmless. */
export function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
