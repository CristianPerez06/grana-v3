import type { GranaSupabaseClient } from '@grana/supabase'
import { resolveAccountAvatar, type ResolvedAccountAvatar } from '@grana/ui-contracts'

// Option catalog for the movement filters sheet, shared by every surface that
// offers one: the web `/transactions` feed, the web account detail, the mobile
// Movimientos tab and the mobile account detail.
//
// The options come from the CATALOG (active accounts + active categories), not
// from the rows a surface happens to have loaded. On the paginated feed that is
// the only correct source: deriving them from the loaded page would grow the
// filter menu every time the user pressed "load more". The trade-off is that an
// option may yield zero rows on a given surface — which is what the
// no-results empty state exists to explain.

export type MovementFilterOptions = {
  accounts: Array<{
    id: string
    name: string
    type: 'cash' | 'bank' | 'credit'
    avatar: ResolvedAccountAvatar
  }>
  categories: Array<{
    id: string
    name: string
    type: 'income' | 'expense' | 'both'
    canonical_name: string
    user_id: string | null
    household_id: string | null
    icon: string | null
    color: string | null
  }>
  /** Subcategories of the active category, or [] when no category is filtered. */
  subcategories: Array<{
    id: string
    name: string
    category_id: string
    canonical_name: string
    user_id: string | null
  }>
}

export async function getMovementFilterOptions(
  supabase: GranaSupabaseClient,
  options: { categoryId?: string } = {},
): Promise<MovementFilterOptions> {
  const [accountsResult, categoriesResult, subcategoriesResult] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, color_key, icon_key, institution:institutions(brand_color, icon_type)')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, type, canonical_name, user_id, household_id, icon, color')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    // Inlined rather than delegated: this is the only subcategory read the
    // package needs, and promoting web's `getSubcategoriesByCategoryId` would
    // have meant a `@grana/categories` package for eight lines. That function
    // stays in web, where it still has a consumer of its own (the settings
    // subcategories page).
    options.categoryId
      ? supabase
          .from('subcategories')
          .select('id, name, category_id, canonical_name, user_id')
          .eq('category_id', options.categoryId)
          .eq('is_active', true)
          .order('name')
      : Promise.resolve({ data: [], error: null }),
  ])

  if (accountsResult.error) throw accountsResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (subcategoriesResult.error) throw subcategoriesResult.error

  const accountRows = (accountsResult.data ?? []) as unknown as Array<{
    id: string
    name: string
    type: 'cash' | 'bank' | 'credit'
    color_key: string | null
    icon_key: string | null
    institution: { brand_color: string | null; icon_type: string | null } | null
  }>

  return {
    accounts: accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      avatar: resolveAccountAvatar(a, a.institution),
    })),
    categories: (categoriesResult.data ?? []) as MovementFilterOptions['categories'],
    subcategories: (subcategoriesResult.data ??
      []) as MovementFilterOptions['subcategories'],
  }
}
