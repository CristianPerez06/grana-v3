import type { DbClient } from '@/lib/supabase/db-client'
import type { Category, CategoryWithSubcategories, Subcategory } from './types'

export async function getAllCategories(
  supabase: DbClient,
): Promise<CategoryWithSubcategories[]> {
  // No explicit user filter: the RLS select policy on categories is exactly
  // "system (user_id IS NULL) or own", so the visible set is already right
  // for any caller (browser or server).
  const { data, error } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_active', true)
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
