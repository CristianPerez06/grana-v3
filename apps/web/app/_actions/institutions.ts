'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createCustomInstitutionSchema,
  validateActionInput,
  type CreateCustomInstitutionInput,
} from '@grana/validation'
import type { Institution } from '@/lib/accounts/types'
import type { ActionResult } from './types'
import { getAuthenticatedUserId } from './_lib/auth'

type CreateResult = ActionResult<CreateCustomInstitutionInput> & { institution?: Institution }

export async function createCustomInstitution(input: unknown): Promise<CreateResult> {
  const validation = await validateActionInput(createCustomInstitutionSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // The DB trigger re-derives slug from name (slugify) for user-owned rows, so
  // the value passed here is overwritten server-side. We still pass one to keep
  // the insert valid against the generated types (slug is NOT NULL in the table).
  const slug = validation.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const { data, error } = await supabase
    .from('institutions')
    .insert({
      name: validation.data.name,
      slug,
      brand_color: validation.data.brand_color,
      icon_type: validation.data.icon_type,
      user_id: userId,
    })
    .select('id, name, slug, brand_color, icon_type, is_active, user_id')
    .single()

  if (error || !data) {
    // 23505 = unique_violation → name already taken by this user.
    if (error?.code === '23505') {
      return { ok: false, fieldErrors: { name: 'duplicate' } }
    }
    return { ok: false, formError: error?.message ?? 'Failed to create institution' }
  }

  revalidatePath('/accounts/new')
  revalidatePath('/accounts')
  return { ok: true, institution: data as Institution }
}
