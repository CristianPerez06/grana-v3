import type { QueryClient } from '@tanstack/react-query'

// Invalidate after a household lifecycle/config mutation (create/join/invite/
// config/leave). Every Hogar query key is prefixed with `'shared'`, so
// invalidating that prefix refetches the home, debt, recents, pending, etc.
// Web's equivalent revalidates the `/shared` path tree wholesale.
export function invalidateAfterSharedMutation(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['shared'] })
}

// Invalidate after a settlement write (register / assign-account / revert).
// Beyond the Hogar queries, a settlement moves an account balance and writes a
// movement, so the account balances, the feed and the dashboard all shift.
export function invalidateAfterSettlement(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['shared'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
