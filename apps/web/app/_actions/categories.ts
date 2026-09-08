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
import { getHousehold } from '@grana/shared'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

// ── Household scope ─────────────────────────────────────────────────────────────
//
// `scope: 'household'` resolves to the caller's active household id. There is
// no client-supplied household id on purpose: the only household a user can put
// a category into is their own, and RLS (0063) rejects anything else anyway.

async function resolveHouseholdScope(
  supabase: ServerClient,
  scope: 'own' | 'household' | undefined,
): Promise<{ ok: true; householdId: string | null } | { ok: false; formError: string }> {
  if (scope !== 'household') return { ok: true, householdId: null }
  const household = await getHousehold(supabase)
  if (!household) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('household_required') }
  }
  return { ok: true, householdId: household.id }
}

// ── Usage guard ─────────────────────────────────────────────────────────────────

type ServerClient = Awaited<ReturnType<typeof createClient>>

// Tables that reference a category/subcategory with a nullable FK. The DB enforces
// ON DELETE RESTRICT on all of them (migration 0026), so a hard delete of something
// still in use is blocked at the source for every client. This guard mirrors that
// check in the app only to return a useful "archive instead" message instead of a
// raw FK error.
const CATEGORY_REF_TABLES = ['transactions', 'recurrences', 'recurrence_instances'] as const

//
// No `user_id` filter: RLS already scopes each table to the rows the caller can
// see (own + shared), and a household category referenced by the other member's
// shared movement is in use just the same. The DB's RESTRICT FK is the last word.
async function isCategoryColumnInUse(
  supabase: ServerClient,
  column: 'category_id' | 'subcategory_id',
  id: string,
): Promise<{ inUse: boolean; errorCode?: string }> {
  for (const table of CATEGORY_REF_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, id)
    if (error) return { inUse: false, errorCode: error.code }
    if ((count ?? 0) > 0) return { inUse: true }
  }
  return { inUse: false }
}

// A category counts as "in use" if it is referenced directly (category_id) OR if
// any of its child subcategories is referenced (subcategory_id). The DB doesn't
// force a row with subcategory_id to also carry its parent category_id, and
// updates can move the two independently — so deleting the parent could otherwise
// hit the child's RESTRICT FK and surface a raw FK error instead of our message.
async function isCategoryInUse(
  supabase: ServerClient,
  categoryId: string,
): Promise<{ inUse: boolean; errorCode?: string }> {
  const direct = await isCategoryColumnInUse(supabase, 'category_id', categoryId)
  if (direct.errorCode || direct.inUse) return direct

  const { data: subs, error: subsError } = await supabase
    .from('subcategories')
    .select('id')
    .eq('category_id', categoryId)
  if (subsError) return { inUse: false, errorCode: subsError.code }

  const subIds = (subs ?? []).map((s) => s.id)
  if (subIds.length === 0) return { inUse: false }

  for (const table of CATEGORY_REF_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in('subcategory_id', subIds)
    if (error) return { inUse: false, errorCode: error.code }
    if ((count ?? 0) > 0) return { inUse: true }
  }
  return { inUse: false }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function createCategory(
  input: unknown,
): Promise<ActionResult<CreateCategoryInput>> {
  const validation = await validateActionInput(createCategorySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const scope = await resolveHouseholdScope(supabase, validation.data.scope)
  if (!scope.ok) return { ok: false, formError: scope.formError, errorCode: 'household_required' }

  const { error } = await supabase.from('categories').insert({
    user_id: userId,
    household_id: scope.householdId,
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

  await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: {
    name?: string
    icon?: string | null
    color?: string | null
    household_id?: string
  } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name
  if (validation.data.icon !== undefined) updates.icon = validation.data.icon
  if (validation.data.color !== undefined) updates.color = validation.data.color
  // Own → household is the only direction offered. `scope: 'own'` on a
  // household category is a no-op: other members may already point at it.
  const scope = await resolveHouseholdScope(supabase, validation.data.scope)
  if (!scope.ok) return { ok: false, formError: scope.formError, errorCode: 'household_required' }
  if (scope.householdId) updates.household_id = scope.householdId

  // No `user_id` filter: a household category is editable by every member, and
  // RLS (0063) is what decides which rows the caller may touch.
  const { error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'category'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function archiveCategory(id: string): Promise<ActionResult<never>> {
  await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('archive_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult<never>> {
  await getAuthenticatedUserId()
  const supabase = await createClient()

  // Hard delete only when the category is unused — directly (category_id) or via
  // any of its child subcategories (subcategory_id) — across transactions,
  // recurrences and recurrence instances. Deleting a used category would destroy
  // historical classification; the user should archive (is_active=false) instead
  // — see archiveCategory. The DB also enforces this via ON DELETE RESTRICT (0026).
  const usage = await isCategoryInUse(supabase, id)
  if (usage.errorCode) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_failed'), errorCode: usage.errorCode }
  }
  if (usage.inUse) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_in_use_category'), errorCode: 'in_use' }
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

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

  await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: { name?: string } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name

  const { error } = await supabase
    .from('subcategories')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { ok: false, formError: await translatePostgresError(error.code, 'subcategory'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function archiveSubcategory(id: string): Promise<ActionResult<never>> {
  await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('subcategories')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('archive_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}

export async function deleteSubcategory(id: string): Promise<ActionResult<never>> {
  await getAuthenticatedUserId()
  const supabase = await createClient()

  // Hard delete only when the subcategory is unused (transactions, recurrences or
  // recurrence instances). Deleting a used subcategory would silently strip the
  // classification off historical rows; the user should archive (is_active=false)
  // instead — see archiveSubcategory. The DB also enforces this via ON DELETE
  // RESTRICT (0026).
  const usage = await isCategoryColumnInUse(supabase, 'subcategory_id', id)
  if (usage.errorCode) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_failed'), errorCode: usage.errorCode }
  }
  if (usage.inUse) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_in_use_subcategory'), errorCode: 'in_use' }
  }

  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', id)

  if (error) {
    const t = await getTranslations('settings.categories.errors')
    return { ok: false, formError: t('delete_failed'), errorCode: error.code }
  }

  revalidatePath('/settings/categories')
  return { ok: true }
}
