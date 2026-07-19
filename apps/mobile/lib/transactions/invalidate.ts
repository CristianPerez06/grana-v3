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

// Cache invalidation after confirming/cancelling a pending reimbursement — the
// mobile twin of web's `invalidateAfterReimbursementMutation`. A confirm moves
// the reintegro into the ledger (real amount/date), which shifts the feed and
// account balances; a statement confirm lands on a card period, so the card
// summaries move too. Same prefixes as a movement mutation.
export function invalidateAfterReimbursementMutation(queryClient: QueryClient): void {
  for (const key of [['transactions'], ['dashboard'], ['accounts'], ['cards']]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}
