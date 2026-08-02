import type { QueryClient } from '@tanstack/react-query'

// Cache invalidation after creating/editing/archiving/deleting a category or
// subcategory — the mobile twin of web's `invalidateAfterCategoryMutation`.
// Lives beside `lib/categories.ts` (a file, not a directory) rather than in a
// `categories/invalidate.ts` that would shadow it.
//
// EVERY category mutation must call this, archive and delete included. The
// settings screens reload their own list through a local `onChanged` callback,
// which says nothing to the TanStack catalog (`['categories','all']`) that the
// movement and recurrence forms read: without this call an archived — or
// deleted — category keeps being offered by those pickers.
//
// Invalidates by prefix so call sites don't have to track which `['categories',
// …]` family is current.
export function invalidateAfterCategoryMutation(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['categories'] })
}
