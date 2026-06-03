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

// ── Flattened variants ─────────────────────────────────────────────────────────
// For rows shaped like FinancialMovement / breakdown slices, where the category
// travels as loose fields instead of an object. Same contract: system entries
// translate via canonical_name; user-owned ones show their literal name.

export function translateCategoryLabel(
  name: string | null,
  canonicalName: string | null,
  isSystem: boolean,
  t: TranslateFn,
): string | null {
  if (isSystem && canonicalName) return t(`categories.${canonicalName}`)
  return name
}

export function translateSubcategoryLabel(
  name: string | null,
  canonicalName: string | null,
  isSystem: boolean,
  t: TranslateFn,
): string | null {
  if (isSystem && canonicalName) return t(`subcategories.${canonicalName}`)
  return name
}
