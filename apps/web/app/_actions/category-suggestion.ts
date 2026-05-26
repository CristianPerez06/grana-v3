'use server'

import { createClient } from '@/lib/supabase/server'
import {
  normalizeDescription,
  categoryTypeMatches,
  type CategorySuggestion,
} from '@/lib/transactions/category-suggestion'

/**
 * Capa 1 del autocategorizador: sugiere la categoría (y subcategoría) que el
 * usuario usó la última vez para una transacción con la MISMA descripción
 * (exacta, normalizada). Devuelve null si no hay historial coincidente o si la
 * categoría no es compatible con el tipo del movimiento. Es una sugerencia: el
 * llamador decide si la aplica (no autocompleta).
 */
export async function suggestCategoryFromHistory(
  description: string,
  type: 'income' | 'expense',
): Promise<CategorySuggestion | null> {
  const normalized = normalizeDescription(description)
  if (!normalized) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('transactions')
    .select('category:categories(id, name, type), subcategory:subcategories(id, name)')
    .eq('user_id', user.id)
    .ilike('description', normalized)
    .not('category_id', 'is', null)
    .eq('is_parent', false)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = data?.[0]
  if (!row) return null

  const category = row.category as unknown as { id: string; name: string; type: string } | null
  const subcategory = row.subcategory as unknown as { id: string; name: string } | null
  if (!category || !categoryTypeMatches(category.type, type)) return null

  return {
    categoryId: category.id,
    categoryName: category.name,
    subcategoryId: subcategory?.id ?? null,
    subcategoryName: subcategory?.name ?? null,
  }
}
