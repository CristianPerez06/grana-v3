'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { mapSupabaseError } from '@/lib/supabase/errors'
import {
  forgotSchema,
  type ForgotInput,
  validateActionInput,
} from '@grana/validation'
import type { ActionResult } from './types'

export const requestPasswordResetAction = async (
  input: unknown,
): Promise<ActionResult<ForgotInput>> => {
  const validation = await validateActionInput(forgotSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const supabase = await createClient()
  // Supabase's resetPasswordForEmail does not distinguish between
  // existing and non-existing accounts in its success path, so surfacing
  // any error here is safe: those errors are rate limits, SMTP failures,
  // or config problems — never enumeration signals. We omit redirectTo
  // intentionally: the email template renders the OTP code, and the user
  // enters it in the in-app verify screen — no link to follow.
  const { error } = await supabase.auth.resetPasswordForEmail(
    validation.data.email,
  )

  if (error) {
    const t = await getTranslations()
    return { ok: false, formError: mapSupabaseError(error, t) }
  }

  return { ok: true }
}
