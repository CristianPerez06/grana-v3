import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateSubcategoryInput,
  type UpdateSubcategoryInput,
  ValidationError,
} from '@grana/validation'
import { supabase } from './supabase'

export type CategoryType = 'income' | 'expense' | 'both'

export type Category = {
  id: string
  user_id: string | null
  name: string
  canonical_name: string
  icon: string | null
  color: string | null
  type: CategoryType
  is_active: boolean
  created_at: string
}

export type Subcategory = {
  id: string
  category_id: string
  user_id: string | null
  name: string
  canonical_name: string
  is_active: boolean
  created_at: string
}

export type CategoryWithSubcategories = Category & {
  subcategories: Subcategory[]
}

export type ActionResult =
  | { ok: true }
  | { ok: false; errorKey: string; fieldErrors?: Record<string, string> }

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function fieldErrorsFromYup(err: ValidationError): Record<string, string> {
  const result: Record<string, string> = {}
  if (err.inner.length === 0 && err.path) {
    result[err.path] = err.message
  } else {
    for (const inner of err.inner) {
      if (inner.path && !result[inner.path]) result[inner.path] = inner.message
    }
  }
  return result
}

function mapPostgresError(code: string | undefined, kind: 'category' | 'subcategory'): string {
  if (code === '23505') {
    return kind === 'category'
      ? 'settings.categories.errors.duplicate'
      : 'settings.categories.errors.duplicate_subcategory'
  }
  return 'settings.categories.errors.generic'
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

// Tables that reference a category/subcategory with a nullable FK. The DB enforces
// ON DELETE RESTRICT on all of them (migration 0026); this guard mirrors that check
// to return a useful "archive instead" message rather than a raw FK error. Keep in
// sync with the web guard in apps/web/app/_actions/categories.ts.
const CATEGORY_REF_TABLES = ['transactions', 'recurrences', 'recurrence_instances'] as const

async function isCategoryColumnInUse(
  column: 'category_id' | 'subcategory_id',
  id: string,
  userId: string,
): Promise<{ inUse: boolean; failed: boolean }> {
  for (const table of CATEGORY_REF_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, id)
      .eq('user_id', userId)
    if (error) return { inUse: false, failed: true }
    if ((count ?? 0) > 0) return { inUse: true, failed: false }
  }
  return { inUse: false, failed: false }
}

// A category counts as "in use" if it is referenced directly (category_id) OR if
// any of its child subcategories is referenced (subcategory_id). The DB doesn't
// force a row with subcategory_id to also carry category_id and updates move them
// independently, so the parent delete could otherwise hit the child's RESTRICT FK
// and surface a raw error instead of our message. Keep in sync with the web guard.
async function isCategoryInUse(
  categoryId: string,
  userId: string,
): Promise<{ inUse: boolean; failed: boolean }> {
  const direct = await isCategoryColumnInUse('category_id', categoryId, userId)
  if (direct.failed || direct.inUse) return direct

  const { data: subs, error: subsError } = await supabase
    .from('subcategories')
    .select('id')
    .eq('category_id', categoryId)
  if (subsError) return { inUse: false, failed: true }

  const subIds = (subs ?? []).map((s) => s.id)
  if (subIds.length === 0) return { inUse: false, failed: false }

  for (const table of CATEGORY_REF_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in('subcategory_id', subIds)
      .eq('user_id', userId)
    if (error) return { inUse: false, failed: true }
    if ((count ?? 0) > 0) return { inUse: true, failed: false }
  }
  return { inUse: false, failed: false }
}

// ── Queries ──────────────────────────────────────────────────────────────────

// Mirror of web's `getAllCategories` (`apps/web/lib/categories/queries.ts`).
// The two are duplicated per platform: a fix applied to only one of them
// leaves half the app broken, which is exactly how archived subcategories
// reached the movement form.
export async function getAllCategories(userId: string): Promise<CategoryWithSubcategories[]> {
  // Both levels filter `is_active`, and both filters live HERE rather than in
  // each consumer. `eq('is_active')` narrows the parent rows; the embedded
  // `subcategories.is_active` narrows the embedded rows only — a category with
  // no active subcategories still comes back, with `subcategories: []`, so it
  // stays selectable and merely stops being drillable. (`subcategories!inner`
  // would instead DROP those categories.)
  const { data, error } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_active', true)
    .eq('subcategories.is_active', true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('type')
    .order('name')

  if (error) throw error
  return (data ?? []) as unknown as CategoryWithSubcategories[]
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as Category | null
}

export async function getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return (data ?? []) as Subcategory[]
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createCategory(input: unknown): Promise<ActionResult> {
  let validated: CreateCategoryInput
  try {
    validated = (await createCategorySchema.validate(input, { abortEarly: false })) as CreateCategoryInput
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, errorKey: 'settings.categories.errors.generic', fieldErrors: fieldErrorsFromYup(err) }
    }
    throw err
  }

  const userId = await requireUserId()

  const { error } = await supabase.from('categories').insert({
    user_id: userId,
    name: validated.name,
    canonical_name: slugify(validated.name),
    type: validated.type,
    icon: validated.icon ?? null,
    color: validated.color ?? null,
  })

  if (error) return { ok: false, errorKey: mapPostgresError(error.code, 'category') }
  return { ok: true }
}

export async function updateCategory(id: string, input: unknown): Promise<ActionResult> {
  let validated: UpdateCategoryInput
  try {
    validated = (await updateCategorySchema.validate(input, { abortEarly: false })) as UpdateCategoryInput
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, errorKey: 'settings.categories.errors.generic', fieldErrors: fieldErrorsFromYup(err) }
    }
    throw err
  }

  const userId = await requireUserId()
  const updates: { name?: string; icon?: string | null; color?: string | null } = {}
  if (validated.name !== undefined) updates.name = validated.name
  if (validated.icon !== undefined) updates.icon = validated.icon
  if (validated.color !== undefined) updates.color = validated.color

  const { error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: mapPostgresError(error.code, 'category') }
  return { ok: true }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: 'settings.categories.errors.archive_failed' }
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId()

  // Hard delete only when unused — directly or via any child subcategory;
  // otherwise archive (is_active=false) instead so historical classification is
  // not lost. The DB also enforces ON DELETE RESTRICT (migration 0026).
  const usage = await isCategoryInUse(id, userId)
  if (usage.failed) return { ok: false, errorKey: 'settings.categories.errors.delete_failed' }
  if (usage.inUse) return { ok: false, errorKey: 'settings.categories.errors.delete_in_use_category' }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: 'settings.categories.errors.delete_failed' }
  return { ok: true }
}

export async function createSubcategory(input: unknown): Promise<ActionResult> {
  let validated: CreateSubcategoryInput
  try {
    validated = (await createSubcategorySchema.validate(input, { abortEarly: false })) as CreateSubcategoryInput
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, errorKey: 'settings.categories.errors.generic', fieldErrors: fieldErrorsFromYup(err) }
    }
    throw err
  }

  const userId = await requireUserId()
  const { error } = await supabase.from('subcategories').insert({
    user_id: userId,
    category_id: validated.category_id,
    name: validated.name,
    canonical_name: slugify(validated.name),
  })

  if (error) return { ok: false, errorKey: mapPostgresError(error.code, 'subcategory') }
  return { ok: true }
}

export async function updateSubcategory(id: string, input: unknown): Promise<ActionResult> {
  let validated: UpdateSubcategoryInput
  try {
    validated = (await updateSubcategorySchema.validate(input, { abortEarly: false })) as UpdateSubcategoryInput
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, errorKey: 'settings.categories.errors.generic', fieldErrors: fieldErrorsFromYup(err) }
    }
    throw err
  }

  const userId = await requireUserId()
  const updates: { name?: string } = {}
  if (validated.name !== undefined) updates.name = validated.name

  const { error } = await supabase
    .from('subcategories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: mapPostgresError(error.code, 'subcategory') }
  return { ok: true }
}

export async function archiveSubcategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('subcategories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: 'settings.categories.errors.archive_failed' }
  return { ok: true }
}

export async function deleteSubcategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId()

  // Hard delete only when unused; otherwise archive (is_active=false) instead so
  // historical classification is not lost. The DB also enforces ON DELETE RESTRICT
  // (migration 0026).
  const usage = await isCategoryColumnInUse('subcategory_id', id, userId)
  if (usage.failed) return { ok: false, errorKey: 'settings.categories.errors.delete_failed' }
  if (usage.inUse) return { ok: false, errorKey: 'settings.categories.errors.delete_in_use_subcategory' }

  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorKey: 'settings.categories.errors.delete_failed' }
  return { ok: true }
}

// ── Display helpers ──────────────────────────────────────────────────────────

type TranslateFn = (key: string) => string

export function getCategoryName(
  category: Pick<Category, 'name' | 'canonical_name' | 'user_id'>,
  t: TranslateFn,
): string {
  if (category.user_id === null) {
    return t(`categories.${category.canonical_name}`)
  }
  return category.name
}

export function getSubcategoryName(
  subcategory: Pick<Subcategory, 'name' | 'canonical_name' | 'user_id'>,
  t: TranslateFn,
): string {
  if (subcategory.user_id === null) {
    return t(`subcategories.${subcategory.canonical_name}`)
  }
  return subcategory.name
}
