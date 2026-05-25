'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slugify'
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  validateActionInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateSubcategoryInput,
  type UpdateSubcategoryInput,
} from '@grana/validation'
import type { ActionResult } from './types'

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

// Maps Postgres error codes to user-facing i18n messages. Uses the active
// locale (read via next-intl cookie) so the message comes back already
// translated for the client to render verbatim. Falls back to a generic
// message when the code isn't known.
async function translatePostgresError(
  code: string | undefined,
  kind: 'category' | 'subcategory',
): Promise<string> {
  const t = await getTranslations('settings.categories.errors')
  if (code === '23505') {
    return kind === 'category' ? t('duplicate') : t('duplicate_subcategory')
  }
  return t('generic')
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function createCategory(
  input: unknown,
): Promise<ActionResult<CreateCategoryInput>> {
  const validation = await validateActionInput(createCategorySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase.from('categories').insert({
    user_id: userId,
    name: validation.data.name,
    canonical_name: slugify(validation.data.name),
    type: validation.data.type,
    icon: validation.data.icon ?? null,
    color: validation.data.color ?? null,
  })

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'category'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function updateCategory(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateCategoryInput>> {
  const validation = await validateActionInput(updateCategorySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: { name?: string; icon?: string | null; color?: string | null } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name
  if (validation.data.icon !== undefined) updates.icon = validation.data.icon
  if (validation.data.color !== undefined) updates.color = validation.data.color

  const { error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'category'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function archiveCategory(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('archive_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // TODO: when transactions module is added, check for associated transactions here
  // and return error if count > 0 before allowing delete.

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

// ── Subcategories ─────────────────────────────────────────────────────────────

export async function createSubcategory(
  input: unknown,
): Promise<ActionResult<CreateSubcategoryInput>> {
  const validation = await validateActionInput(createSubcategorySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase.from('subcategories').insert({
    category_id: validation.data.category_id,
    user_id: userId,
    name: validation.data.name,
    canonical_name: slugify(validation.data.name),
  })

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'subcategory'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function updateSubcategory(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateSubcategoryInput>> {
  const validation = await validateActionInput(updateSubcategorySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: { name?: string } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name

  const { error } = await supabase
    .from('subcategories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'subcategory'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function archiveSubcategory(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('subcategories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('archive_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function deleteSubcategory(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // TODO: when transactions module is added, check for associated transactions here.

  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}
