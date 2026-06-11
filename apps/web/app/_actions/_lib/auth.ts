import { createClient } from '@/lib/supabase/server'
import { getProjectJwks } from '@/lib/supabase/jwks'

/**
 * Resolve the current authenticated user's id, throwing `Unauthorized` when
 * there is no session. Shared by the server actions so the auth gate lives in
 * one place instead of being re-declared per action file.
 *
 * Validation is local: getClaims() verifies the JWT signature against the
 * project's asymmetric signing key instead of a network round-trip to the
 * Auth server per action (the proxy already refreshed the session). Trade-off
 * per the web-data-access spec: a revoked session stays valid until the
 * access token expires.
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const jwks = await getProjectJwks()
  const { data } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined)
  const sub = data?.claims.sub
  if (!sub) throw new Error('Unauthorized')
  return sub
}
