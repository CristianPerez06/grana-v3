// Pure helpers for the history-based category suggestion (Capa 1).
// The DB lookup itself lives in the platform action; these are the testable
// bits, shared cross-platform.

export type CategorySuggestion = {
  categoryId: string
  categoryName: string
  /** Translation handles: system categories render `categories.{canonical_name}`. */
  categoryCanonicalName: string
  categoryIsSystem: boolean
  subcategoryId: string | null
  subcategoryName: string | null
  subcategoryCanonicalName: string | null
  subcategoryIsSystem: boolean
}

/**
 * Normalizes a description for exact history matching: trimmed + lowercased.
 * Returns null when too short to be meaningful (< 2 chars), so the caller skips
 * the lookup.
 */
export function normalizeDescription(description: string): string | null {
  const normalized = description.trim().toLowerCase()
  return normalized.length >= 2 ? normalized : null
}

/**
 * A suggested category only applies if its type is compatible with the movement
 * being registered (a 'both' category fits either; otherwise it must match).
 */
export function categoryTypeMatches(
  categoryType: string,
  movementType: 'income' | 'expense',
): boolean {
  return categoryType === movementType || categoryType === 'both'
}
