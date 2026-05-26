// Pure helpers for the history-based category suggestion (Capa 1).
// The DB lookup itself lives in the server action; these are the testable bits.

export type CategorySuggestion = {
  categoryId: string
  categoryName: string
  subcategoryId: string | null
  subcategoryName: string | null
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
