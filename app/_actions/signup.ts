'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { mapSupabaseError } from '@/lib/supabase/errors'
import { signupSchema, type SignupInput } from '@/lib/validation/auth'
import { validateActionInput } from '@/lib/validation/validate-action-input'
import type { ActionResult } from './types'

export const signupAction = async (
  input: unknown,
): Promise<ActionResult<SignupInput>> => {
  const validation = await validateActionInput(signupSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { fullName, email, password } = validation.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    const t = await getTranslations()
    return { ok: false, formError: mapSupabaseError(error, t) }
  }

  // Supabase silently no-ops when the email is already registered AND
  // "Confirm email" is enabled, returning a fake success with an empty
  // `identities` array (this is intentional enumeration protection on
  // their side). We detect it and surface the explicit error our spec
  // demands.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    const t = await getTranslations()
    return { ok: false, formError: t('auth.errors.user_already_exists') }
  }

  return { ok: true }
}
