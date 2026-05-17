'use server'

import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { mapSupabaseError } from '@/lib/supabase/errors'
import {
  forgotSchema,
  type ForgotInput,
  validateActionInput,
} from '@grana/validation'
import type { ActionResult } from './types'

const getOrigin = async () => {
  const h = await headers()
  const explicitOrigin = h.get('origin')
  if (explicitOrigin) return explicitOrigin

  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto =
    h.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  return `${proto}://${host}`
}

export const requestPasswordResetAction = async (
  input: unknown,
): Promise<ActionResult<ForgotInput>> => {
  const validation = await validateActionInput(forgotSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const origin = await getOrigin()
  const supabase = await createClient()
  // Supabase's resetPasswordForEmail does not distinguish between
  // existing and non-existing accounts in its success path, so surfacing
  // any error here is safe: those errors are rate limits, SMTP failures,
  // or config problems — never enumeration signals.
  const { error } = await supabase.auth.resetPasswordForEmail(
    validation.data.email,
    { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  )

  if (error) {
    const t = await getTranslations()
    return { ok: false, formError: mapSupabaseError(error, t) }
  }

  return { ok: true }
}
