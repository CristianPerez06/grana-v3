import { createClient } from '@/lib/supabase/server'
import type { Category, CategoryWithSubcategories, Subcategory } from './types'

export async function getAllCategories(userId: string): Promise<CategoryWithSubcategories[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_active', true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('type')
    .order('name')

  if (error) throw error
  return (data ?? []) as CategoryWithSubcategories[]
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Category | null
}

export async function getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return (data ?? []) as Subcategory[]
}
