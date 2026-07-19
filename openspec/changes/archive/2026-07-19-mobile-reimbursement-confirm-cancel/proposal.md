# Mobile: confirm/cancel a pending reimbursement from the feed

## Why

Declaring a reintegro is already at parity on mobile (the movement form wires
`saveExpenseReimbursement`). The **other half of the lifecycle is a dead end**:
a *pending* reintegro that later arrives must be **confirmed** (reconciling the
real amount/date), or — if it never arrives — **cancelled**. On web this lives
in the "Reintegros a confirmar" block on the feed. Mobile has no such
affordance: the account detail shows a **read-only** `PendingReimbursementsCard`
and the Movimientos feed shows nothing, so a declared reintegro shows as pending
forever.

The spec already defines this behavior platform-agnostically (confirm =
reconcile amount+date and set `received_at`; cancel sets `cancelled_at`; both
guard the pending state). What's missing is the **native rendering** plus the
shared mutators mobile needs to call — the exact same shape as the
recurring-hub pending block that already shipped.

## What Changes

- **Extract** `confirmReimbursement` / `cancelReimbursement` from the web-local
  server action (`apps/web/app/_actions/reimbursements.ts`) into
  `@grana/transactions-mutations` as isomorphic `(supabase, userId, input) →
  result` functions. Web re-points its two actions to thin wrappers. This is
  the **second consumer** — the trigger for extraction, same as the transaction
  mutators and `@grana/recurrences`. Behavior-preserving: the existing
  `apps/web/lib/transactions/__tests__/reimbursements.test.ts` stays green.
- **Add mobile mutators** (`apps/mobile/lib/transactions/mutators.ts` +
  `invalidate.ts`): thin `confirmReimbursement` / `cancelReimbursement` shells
  (auth + delegate + localize) and a `invalidateAfterReimbursementMutation`
  helper, mirroring the recurrence mutators.
- **Add an actionable "Reintegros a confirmar" block on the Movimientos feed**,
  a native sibling of `PendingRecurrencesBlock` — a thin consumer of the
  already-shared `getPendingReimbursements`. Per row: an **inline-expand**
  confirm (amount defaulted to the estimated value + date defaulted to the
  consumption date), plus a destructive **Cancelar**. Confirm reconciles
  **amount + date only** (parity with web — there is no account picker; for a
  `statement` target the server derives the card period from the date).

## Impact

- Affected specs: `transactions` (1 ADDED requirement for the native
  pending-reimbursements block; 1 MODIFIED requirement to correct the feed
  requirement's now-false "pending blocks out of scope" exclusion).
- Affected code: `packages/transactions-mutations` (extract), `apps/web`
  (re-point two actions to wrappers), `apps/mobile` (mutators + invalidate +
  feed block).
- No data model, no migration, no RLS change. Confirm/cancel semantics are
  identical to web; only the code location and the native surface are new.

## Out of scope

- The **account-detail** pending card stays read-only for now (feed-only v1).
  Upgrading it to actionable is a follow-up; noted as a deferral.
- Surfacing confirm/cancel inline on the **movement detail** tile
  (`TileReimbursementNet`) — web keeps that tile read-only too; out of scope.
- Reabrir (reopening) a cancelled reintegro — separate flow, not built on web
  either.
