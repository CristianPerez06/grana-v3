type TranslateFn = (key: string) => string

export function getCategoryName(
  category: { name: string; canonical_name: string; user_id: string | null },
  t: TranslateFn
): string {
  if (category.user_id === null) {
    return t(`categories.${category.canonical_name}`)
  }
  return category.name
}

export function getSubcategoryName(
  subcategory: { name: string; canonical_name: string; user_id: string | null },
  t: TranslateFn
): string {
  if (subcategory.user_id === null) {
    return t(`subcategories.${subcategory.canonical_name}`)
  }
  return subcategory.name
}
