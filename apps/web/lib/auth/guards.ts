import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectJwks } from '@/lib/supabase/jwks'

// Both guards validate the session locally (getClaims verifies the JWT
// signature against the project's asymmetric signing key; JWKS cached at
// module scope) instead of a network round-trip to the Auth server per
// render. Trade-off per the web-data-access spec: a revoked session stays
// valid until the access token expires.

const getVerifiedClaims = async () => {
  const supabase = await createClient()
  const jwks = await getProjectJwks()
  const { data } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined)
  return data?.claims ?? null
}

export const redirectIfAuthenticated = async (target = '/dashboard') => {
  const claims = await getVerifiedClaims()
  if (claims) redirect(target)
}

/** Auth gate for authenticated layouts: redirects to login when there is no
 *  valid session, returns the verified user id otherwise. */
export const requireUserId = async (): Promise<string> => {
  const claims = await getVerifiedClaims()
  if (!claims?.sub) redirect('/login')
  return claims.sub
}
