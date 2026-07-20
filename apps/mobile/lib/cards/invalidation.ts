import type { QueryClient } from '@tanstack/react-query'

// Invalidate after any card mutation. Coarse on purpose: a create shifts the
// wallet, the month-summary hero, the header count and (potentially) the archived
// list. Every cards query key is prefixed with `'cards'`, so invalidating that
// prefix refetches them all. Web's equivalent revalidates the `/cards` and
// `/accounts` path trees wholesale.
export function invalidateAfterCardMutation(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['cards'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
}

// Invalidate after paying a statement or editing period dates. Beyond the card
// queries, a payment writes an expense (+ optional stamp-tax) and moves a debit
// balance, so the feed, the account balances and the dashboard all shift. Web's
// equivalent revalidates `/cards`, `/accounts`, `/transactions` and `/` wholesale.
export function invalidateAfterCardPayment(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['cards'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
