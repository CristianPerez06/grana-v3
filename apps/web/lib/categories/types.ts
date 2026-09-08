export type CategoryType = 'income' | 'expense' | 'both'

export type Category = {
  id: string
  user_id: string | null
  /**
   * Household that owns the category, or null. A household category keeps
   * `user_id` (who created it) and is visible, usable and editable by every
   * member. "System" is still `user_id === null` — a household category is
   * never system, and a system category never belongs to a household.
   */
  household_id: string | null
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
  /** See `Category.household_id`. Inherited from a household parent. */
  household_id: string | null
  name: string
  canonical_name: string
  is_active: boolean
  created_at: string
}

export type SystemCategory = Category & { user_id: null; household_id: null }
export type UserCategory = Category & { user_id: string; household_id: null }
export type HouseholdCategory = Category & { user_id: string; household_id: string }

/** Which of the three owners a category (or subcategory) has. */
export type CategoryScope = 'system' | 'own' | 'household'

export function categoryScope(row: { user_id: string | null; household_id: string | null }): CategoryScope {
  if (row.user_id === null) return 'system'
  return row.household_id === null ? 'own' : 'household'
}

export type CategoryWithSubcategories = Category & {
  subcategories: Subcategory[]
}
