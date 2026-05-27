import { createClient } from '@/lib/supabase/server'

/**
 * Resolve the current authenticated user's id, throwing `Unauthorized` when
 * there is no session. Shared by the server actions so the auth gate lives in
 * one place instead of being re-declared per action file.
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}
