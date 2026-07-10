import type { QueryClient } from '@tanstack/react-query'

// Cache invalidation after a movement create/update — the mobile twin of web's
// `invalidateAfterMovementMutation`. A new/edited movement shifts the feed, the
// account balances, the dashboard aggregates and (for card consumos) the card
// summaries, so we invalidate each of those key prefixes. TanStack matches by
// prefix, so `['transactions']` also refreshes `['transactions','feed',…]` and
// `['transactions','has-any']`.
export function invalidateAfterMovementMutation(queryClient: QueryClient): void {
  for (const key of [['transactions'], ['dashboard'], ['accounts'], ['cards']]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}
