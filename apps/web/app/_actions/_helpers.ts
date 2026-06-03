import { revalidatePath } from 'next/cache'

// Centralized server-side cache invalidation helpers for actions whose effect
// crosses several routes. Counterparts to the client-side TanStack helpers
// in `apps/web/lib/transactions/invalidation.ts` — keep the two in sync when
// adding a new route that surfaces data affected by a mutation.
//
// Each helper calls `revalidatePath('/<segment>', 'layout')` (the layout
// flag invalidates the segment + all descendants), so a single call covers
// dynamic routes like `/accounts/[id]` and `/transactions/[id]` without
// enumerating them. Multiple calls are cheap; missing one means a route shows
// stale data on the next visit.

/**
 * Invalidate every route that surfaces movement data after a create, update,
 * or delete of a movement (income, expense, transfer, adjustment, exchange,
 * card payment).
 *
 * Affected routes:
 *   /dashboard     — hero (available balance), month balance, category teaser
 *   /transactions  — list + breakdowns + filter options + recurrence links
 *   /accounts      — list + per-account balances + per-account movements
 *   /cards         — list + card period + card movements
 *   /shared        — household debt + pending settlements
 */
export function revalidateAfterMovementMutation(): void {
  revalidatePath('/dashboard')
  revalidatePath('/transactions', 'layout')
  revalidatePath('/accounts', 'layout')
  revalidatePath('/cards', 'layout')
  revalidatePath('/shared')
}

/**
 * Invalidate routes affected by a recurrence rule mutation (create / update /
 * pause / resume / delete a rule) or a recurrence instance mutation that does
 * NOT create a movement on its own (e.g. skip an instance).
 *
 * Affected routes:
 *   /transactions             — pending block + top suggestion
 *   /transactions/recurring   — rule list (and per-rule detail)
 *   /dashboard                — top suggestion is also surfaced here in some shells
 */
export function revalidateAfterRecurrenceMutation(): void {
  revalidatePath('/transactions', 'layout')
  revalidatePath('/dashboard')
}

/**
 * Invalidate routes affected by a reimbursement mutation (confirm received /
 * cancel pending).
 *
 * Affected routes:
 *   /transactions — pending block + list (the reimbursement row state changes)
 *   /accounts     — balance + per-account movement view
 *   /cards        — card period movements (when the reimbursement targets a card)
 *   /dashboard    — hero + breakdowns when the refund lands in the displayed month
 */
export function revalidateAfterReimbursementMutation(): void {
  revalidatePath('/transactions', 'layout')
  revalidatePath('/accounts', 'layout')
  revalidatePath('/cards', 'layout')
  revalidatePath('/dashboard')
}

/**
 * Invalidate routes affected by a recurrence-suggestion mutation (accept the
 * suggestion as a new rule / dismiss).
 *
 * Affected routes:
 *   /transactions             — top suggestion banner
 *   /transactions/recurring   — accepting a suggestion creates a new rule
 *   /dashboard                — top suggestion appears on the dashboard too
 */
export function revalidateAfterSuggestionMutation(): void {
  revalidatePath('/transactions', 'layout')
  revalidatePath('/dashboard')
}

/**
 * Invalidate routes affected by an account mutation that does not touch
 * movements (archive, reactivate, delete, edit, currency add/deactivate).
 *
 * Affected routes:
 *   /accounts           — list (active + archived sections), and per-account
 *                         detail under /accounts/[id] (the `'layout'` flag
 *                         covers nested segments).
 *   /cards              — credit accounts surface here too; archive flows
 *                         under the credit-card sub-section read the same
 *                         account state.
 *   /dashboard          — hero balances + per-account chip breakdowns.
 *
 * Movement mutations should call `revalidateAfterMovementMutation` instead —
 * it already covers `/accounts` (layout) plus the movement-side routes.
 */
export function revalidateAfterAccountMutation(): void {
  revalidatePath('/accounts', 'layout')
  revalidatePath('/cards', 'layout')
  revalidatePath('/dashboard')
}
