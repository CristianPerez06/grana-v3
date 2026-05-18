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

export type SystemCategory = Category & { user_id: null }
export type UserCategory = Category & { user_id: string }

export type CategoryWithSubcategories = Category & {
  subcategories: Subcategory[]
}
