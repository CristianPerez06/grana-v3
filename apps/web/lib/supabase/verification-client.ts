import { createClient } from '@grana/supabase'
import type { AuthError } from '@supabase/supabase-js'

/**
 * Throwaway client used ONLY to check whether a password is the account's
 * current one.
 *
 * It deliberately does NOT go through `createBrowserClient` (`lib/supabase/client.ts`):
 * that one persists the session in cookies by design, so a successful
 * `signInWithPassword` would swap the live session mid-flow — rewriting the
 * auth cookies the middleware reads on the next request, and leaving the user
 * on a freshly rotated session if a later step fails. With `persistSession:
 * false` the check is a pure predicate: nothing is written anywhere.
 *
 * Supabase still opens a server-side session for the successful sign-in, which
 * no client ever holds. The caller's `signOut({ scope: 'others' })` collects it
 * along with the other devices' sessions.
 */
const createVerificationClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )

/** Returns the auth error when the password is not the account's current one, `null` when it is. */
export const verifyCurrentPassword = async (
  email: string,
  password: string,
): Promise<AuthError | null> => {
  const { error } = await createVerificationClient().auth.signInWithPassword({
    email,
    password,
  })
  return error
}
