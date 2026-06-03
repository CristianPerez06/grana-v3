import { TransactionsShell } from './_components/transactions-shell'

/**
 * Auth-gated entry point for the /transactions route. The auth check is
 * already enforced by `apps/web/app/(app)/layout.tsx`; this page is the
 * trivial mount of the client shell. The header + drawer loader live in
 * `transactions/layout.tsx` so the chrome paints synchronously and persists
 * during transitions (Variant C of the `route-loading-and-errors` spec).
 */
export default function TransactionsPage() {
  return <TransactionsShell />
}
