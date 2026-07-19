import type { QueryClient } from '@tanstack/react-query'

// Cache invalidation for recurrence mutations — the mobile twin of web's
// `revalidateAfterRecurrenceMutation`. Lifecycle changes (pause/resume/delete,
// skip, accept/dismiss) shift the hub and the feed's pending block, both keyed
// under `['recurrences']`. TanStack matches by prefix.
export function invalidateAfterRecurrenceMutation(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['recurrences'] })
}

// Confirming an instance additionally materializes a real movement, so it shifts
// the feed, account balances, dashboard aggregates and card summaries — the same
// prefixes `invalidateAfterMovementMutation` touches — on top of the recurrence
// queries.
export function invalidateAfterRecurrenceConfirm(queryClient: QueryClient): void {
  for (const key of [['recurrences'], ['transactions'], ['dashboard'], ['accounts'], ['cards']]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}
