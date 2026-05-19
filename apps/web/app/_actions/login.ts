'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { mapSupabaseError } from '@/lib/supabase/errors'
import {
  loginSchema,
  type LoginInput,
  validateActionInput,
} from '@grana/validation'
import type { ActionResult } from './types'

export const loginAction = async (
  input: unknown,
): Promise<ActionResult<LoginInput>> => {
  const validation = await validateActionInput(loginSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(validation.data)

  if (error) {
    const t = await getTranslations()
    return {
      ok: false,
      formError: mapSupabaseError(error, t),
      errorCode: error.code ?? undefined,
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
