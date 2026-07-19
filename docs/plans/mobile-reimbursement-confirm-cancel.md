# Exploration brief — mobile reimbursement confirm/cancel

_Status: not started. This is a thinking brief for `/openspec-explore`, not a task list._
_Guide item: §4 "feed & detail extras" → **Pending reimbursements block (confirm/cancel a reintegro)** — the guide flags this as the highest-value remaining transactions item; it closes the reintegro round-trip and unblocks the pending-reimbursements block._

## Context

A **reimbursement (reintegro)** is declared at expense-creation time ("me van a devolver parte de esto"): the movement form's reimbursement block creates a *pending* reimbursement transaction with an `estimated_amount`, a `target` (`account` = cash/bank, or `statement` = a credit-card period), and an optional "received now" fast-path. That declaration path is **already at parity on mobile** — `saveExpenseReimbursement` is shared in `@grana/transactions-mutations` and the movement form wires it.

What's missing is the **other half of the lifecycle**: a *pending* reintegro that later actually arrives must be **confirmed** (reconciling the real amount / date / destination), or — if it never arrives — **cancelled**. On web this happens in a **pending-reimbursements block** on the feed and the account detail. Mobile has neither the block nor any confirm/cancel affordance, so a declared reintegro is a dead end: it shows as pending forever.

## Current state

**Already shared (`@grana/*`) — reuse directly:**
- Reads: `getPendingReimbursements`, `getReimbursementsForExpense` (`@grana/transactions`). The mobile detail already renders `TileReimbursementNet` from the latter.
- Schemas: `confirmReimbursementSchema`, `cancelReimbursementSchema` + inferred types (`@grana/validation`).
- The cross-domain helper `confirmReimbursement` needs for the `statement` path — `getOrCreatePeriodForDate` — is **already shared** (`@grana/transactions-mutations/internal/card-periods.ts`). So extraction is **not** blocked by a web-local card dependency.

**Still web-local — the actual gap:**
- `confirmReimbursement` and `cancelReimbursement` live in `apps/web/app/_actions/reimbursements.ts` (auth + DB write + `revalidateAfterReimbursementMutation`, not split into a package). **This is the second real consumer → it triggers extraction**, the same pattern as `@grana/recurrences` and the transaction mutators.
- UI: `pending-reimbursements-block` (feed + account containers) is web-only React.

**What the two mutations do (behavior to preserve):**
- **confirm** (reconcile): validates the row is a still-pending reimbursement (not received, not cancelled), sets `received_at = now`, overwrites `amount` (real) and `date` (real). `estimated_amount` is immutable (DB trigger). For `target = 'account'` it sets the destination `account_id`; for `target = 'statement'` it resolves the card period covering `date` via `getOrCreatePeriodForDate` and **rejects if that period is already paid**.
- **cancel**: validates still-pending, sets `cancelled_at = now`. Idempotent (already-cancelled → ok). A *received* reintegro cannot be cancelled (received/cancelled are mutually exclusive — `chk_reimbursement_state`).

**Web confirm UX (to re-author natively):** per pending row, an inline reconcile form — `MoneyAmountInput` defaulting to the estimated amount + a date picker defaulting to today/consumption date. For `statement` the period is server-derived from that date (no picker). Cancel is a one-tap action (with a destructive confirm). Confirm payload = `{ id, amount, date, account_id? , card_period_id? }`.

## Direction

Same thin-consumer shape as the recurring work just shipped:

1. **Extract** `confirmReimbursement` / `cancelReimbursement` into `@grana/transactions-mutations` as isomorphic `(supabase, userId, input) → result` functions (validation + DB write inside; auth + cache-invalidation stay per-shell). Web re-points its two actions to thin wrappers — **468 web tests staying green is the proof of behavior-preservation** (there's already `apps/web/lib/transactions/__tests__/reimbursements.test.ts` to lean on). Guard/error messages are Spanish-only in the web action → mobile localizes to generic, same as the recurrence mutators.
2. **Mobile mutators** (`apps/mobile/lib/transactions/`): `confirmReimbursement` / `cancelReimbursement` (auth + delegate + invalidate). Reuse the `localizeForm`-style pattern from the recurrence mutators.
3. **Mobile UI — two entry surfaces, mirror of web:**
   - A **pending-reimbursements block** on the feed (and later the account detail), a thin consumer of `getPendingReimbursements` — a native sibling of the existing `PendingRecurrencesBlock` (same "pending block above the list" idiom).
   - Confirm = inline reconcile (amount default = estimated, date default = today; `account` target adds an account picker via the shared `AccountSelectField`; `statement` target derives the period server-side). Cancel = `Alert.alert` destructive.
   - Consider also surfacing confirm/cancel on the **movement detail** where `TileReimbursementNet` already shows the linked reintegro, so a pending one is actionable in place.
4. **i18n**: `transactions.reimbursement.*` and the pending-block copy largely exist (the movement form already uses them). Expect near-zero new keys; verify the confirm/cancel action + empty-state copy.

## Open questions

- **Slice size.** Is this one change (extract + mobile mutators + feed block + detail affordance), or split feed-block from detail-affordance? The recurring precedent bundled the equivalent pending block into one change — likely fine to do the same here.
- **Where does confirm/cancel live on mobile?** Feed pending-block only (web's primary), or also inline on the movement detail tile? Web has it in the block + the account container; the detail tile is read-only on web. Decide whether mobile adds the in-detail affordance or matches web (block-only).
- **`account` target — account picker default.** Web confirm reconciles the destination account; what's the sensible default on mobile (the declared account? the card's own bank)? Check what web pre-fills.
- **Account-detail block too, or feed-only for v1?** Web shows a pending-reimbursements block on both feed and account detail. Feed-only is a reasonable first slice; note the deferral explicitly if so.
- **"Received now" interaction.** A reintegro declared as *received now* is already confirmed at creation, so it never appears as pending — confirm/cancel only applies to the *pending* set. Verify no edge case where a received-now reintegro leaks into the pending read.
- **Extraction seam.** `confirmReimbursement` reaches into the cards domain (`getOrCreatePeriodForDate`, `period_payments` paid-check). It's already shared, but confirm the package dependency direction (`transactions-mutations` → its own `internal/card-periods`) stays clean and doesn't create a cycle with `@grana/cards`.

## Readiness summary

| Piece | State |
|---|---|
| Reads (`getPendingReimbursements`, `getReimbursementsForExpense`) | ✅ shared |
| Schemas (`confirm`/`cancelReimbursementSchema`) | ✅ shared |
| Period helper (`getOrCreatePeriodForDate`) | ✅ shared |
| `confirmReimbursement` / `cancelReimbursement` mutators | ❌ web-local → **extract** |
| Mobile pending-reimbursements block + confirm/cancel UI | ❌ missing |
| i18n | ✅ mostly present |

Net: a **mutator-extraction + thin-consumer** change, the same well-worn shape as the recurring hub — no new data model, no migrations.
