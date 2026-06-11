import type { JWK } from '@supabase/supabase-js'

// Module-scope cache of the project's JSON Web Key Set, shared by every
// server-side getClaims() call (proxy + server actions). auth-js caches the
// JWKS per client instance, but server clients are created fresh on every
// request, so without this cache local JWT verification would re-fetch
// /.well-known/jwks.json each time and the saved auth round-trip would
// reappear.
const JWKS_TTL_MS = 10 * 60 * 1000

let jwksCache: { keys: JWK[] } | null = null
let jwksCachedAt = 0

export const getProjectJwks = async (): Promise<{ keys: JWK[] } | undefined> => {
  const now = Date.now()
  if (jwksCache && now - jwksCachedAt < JWKS_TTL_MS) return jwksCache
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    )
    if (!res.ok) return jwksCache ?? undefined
    jwksCache = (await res.json()) as { keys: JWK[] }
    jwksCachedAt = now
    return jwksCache
  } catch {
    // Stale keys beat no keys; getClaims falls back to its own fetch when the
    // kid is not found in the supplied set.
    return jwksCache ?? undefined
  }
}
