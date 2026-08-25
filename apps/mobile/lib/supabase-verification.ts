import { createClient } from '@grana/supabase'
import type { AuthError } from '@supabase/supabase-js'

/**
 * Throwaway client used ONLY to check whether a password is the account's
 * current one.
 *
 * It deliberately skips the `ExpoSecureStoreAdapter` that `lib/supabase.ts`
 * wires up: a successful `signInWithPassword` on the live client would swap the
 * session mid-flow and rewrite SecureStore, leaving the user on a freshly
 * rotated session if a later step fails. With `persistSession: false` the check
 * is a pure predicate: nothing is written anywhere.
 *
 * Supabase still opens a server-side session for the successful sign-in, which
 * no client ever holds. The caller's `signOut({ scope: 'others' })` collects it
 * along with the other devices' sessions.
 */
const createVerificationClient = () =>
  createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )

/** Returns the auth error when the password is not the account's current one, `null` when it is. */
export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<AuthError | null> {
  const { error } = await createVerificationClient().auth.signInWithPassword({
    email,
    password,
  })
  return error
}
