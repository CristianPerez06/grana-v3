import type { QueryClient } from '@tanstack/react-query'
import { accountKeys } from './query-keys'

// Invalidate after any account mutation. Coarse on purpose: a mutation can shift
// list membership (archive/reactivate), balances (add currency), the detail, and
// the institution catalog (custom institution). Web's equivalent revalidates the
// `/accounts` path tree wholesale; the native analogue wipes the `accounts` root
// plus the institutions key. The optional `id` also targets that detail/movements
// explicitly so a mounted detail screen refetches immediately.
export function invalidateAfterAccountMutation(
  queryClient: QueryClient,
  id?: string,
): void {
  queryClient.invalidateQueries({ queryKey: accountKeys.all })
  queryClient.invalidateQueries({ queryKey: accountKeys.institutions })
  if (id) {
    queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) })
    queryClient.invalidateQueries({ queryKey: accountKeys.movements(id) })
    queryClient.invalidateQueries({ queryKey: accountKeys.pendingReimbursements(id) })
  }
}
