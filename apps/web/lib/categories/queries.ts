import type { DbClient } from '@/lib/supabase/db-client'
import type { Category, CategoryWithSubcategories, Subcategory } from './types'

export async function getAllCategories(
  supabase: DbClient,
): Promise<CategoryWithSubcategories[]> {
  // No explicit user filter: the RLS select policy on categories is exactly
  // "system (user_id IS NULL), own, or of a household the caller belongs to"
  // (0063), so the visible set is already right for any caller (browser or
  // server).
  //
  // Both levels filter `is_active`, and both filters live HERE rather than in
  // each consumer. `eq('is_active')` narrows the parent rows; the embedded
  // `subcategories.is_active` narrows the embedded rows only — a category with
  // no active subcategories still comes back, with `subcategories: []`, so it
  // stays selectable and merely stops being drillable. (`subcategories!inner`
  // would instead DROP those categories, including every system category that
  // never had subcategories.) A catalog that hands out archived items is a
  // wrong read: consumers list what they get without re-filtering.
  const { data, error } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_active', true)
    .eq('subcategories.is_active', true)
    .order('type')
    .order('name')

  if (error) throw error
  return (data ?? []) as CategoryWithSubcategories[]
}

export async function getCategoryById(
  supabase: DbClient,
  id: string,
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Category | null
}

export async function getSubcategoriesByCategoryId(
  supabase: DbClient,
  categoryId: string,
): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return (data ?? []) as Subcategory[]
}
