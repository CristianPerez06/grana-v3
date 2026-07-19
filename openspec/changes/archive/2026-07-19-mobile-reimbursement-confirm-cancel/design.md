# Design — mobile reimbursement confirm/cancel

## Shape: extract → mobile shell → actionable feed block

Identical to the recurring-hub pending block. Three layers, no new data model.

```
  ┌─ @grana/transactions-mutations (isomorphic) ──────────────┐
  │ confirmReimbursement(supabase, userId, input) → result    │
  │ cancelReimbursement(supabase, userId, input)  → result    │
  │   · validates with confirm/cancelReimbursementSchema      │
  │   · fetches the row, guards pending state                 │
  │   · statement target → getOrCreatePeriodForDate (own      │
  │     internal/card-periods) + rejects if period paid       │
  │   · writes received_at/amount/date or cancelled_at        │
  └───────────────────────────────────────────────────────────┘
        ▲                                    ▲
   web thin wrapper                    mobile thin shell
   (auth + revalidate)                 (auth + localize + invalidate)
   apps/web/app/_actions/              apps/mobile/lib/transactions/
     reimbursements.ts                   mutators.ts + invalidate.ts
        ▲                                    ▲
   PendingReimbursementsBlock          PendingReimbursementsBlock (native)
   (web, unchanged)                    on the Movimientos feed
```

## Why extract now (not before)

The web action does inline supabase reads/writes; it never went through a
package. With mobile as a second caller, that inline logic becomes shared
surface. It slots into `thin-mutations.ts` — the same
`(supabase, userId, input) → { ok, formError?, fieldErrors? }` boundary as the
movement create/update bodies, and that file **already imports**
`getOrCreatePeriodForDate` from `./internal/card-periods`. So the confirm's
statement path reuses the shared period helper directly — **no cycle** with
`@grana/cards`, no new dependency.

Guard messages in the web action are Spanish-only string literals ("El
reintegro ya fue confirmado.", etc.). They move into the package verbatim
(web already renders them as-is). Mobile localizes any `formError` it can't
map to a generic recurrence-style message — same `localize`-style degrade the
recurrence mutators use.

## Confirm reconciles amount + date only — no account picker

The decisive finding from the web `PendingReimbursementsBlock`: `handleConfirm`
sends **only** `{ id, amount, date }`.

- `account` target → the declared destination account is **untouched** (the
  action sets `account_id` only if passed, and the UI never passes it).
- `statement` target → the server derives the period from `date` via
  `getOrCreatePeriodForDate` and rejects a paid period. No period picker.

So mobile confirm is **two fields**: real amount + real date. No
`AccountSelectField`, no period selector. This kills the brief's "account-picker
default" question entirely.

Confirm payload (mobile → mutator, mirror of web):

```ts
{ id, amount: parseMoneyInput(amountStr), date: dateStr }
// amount default = estimatedAmount ; date default = expenseDate ?? todayISO
```

## Native UI — inline expand (Option A, mirror of web)

A block "Reintegros a confirmar" above the feed list, sibling of
`PendingRecurrencesBlock`, thin consumer of `getPendingReimbursements(supabase)`
(unscoped = global). Renders **nothing** when there are none (same as the
recurrences block and the existing account card).

Per row, inline-expand (no sheet):

```
  Netflix                              + $4.500
  [ Confirmar ]  [ Cancelar ]
      │ tap Confirmar
      ▼ expands in place
  Monto real [ 4500 ]   Fecha [ hoy ]
  [ Confirmar ]                          ← commits { id, amount, date }
```

- **Confirmar** expands the two pre-filled inputs, then commits. Because both
  default to sensible values, the common path is expand → tap again.
- **Cancelar** → `Alert.alert` destructive confirm → `cancelReimbursement`.
- Per-row busy state + inline error text; a transient success line, like web.
- Amount via `MoneyAmountInput`, date via `DateField` — existing primitives.
  Category/description title derived from the VM, same fields the read-only
  `PendingReimbursementsCard` already renders.

## Invalidation

Add `invalidateAfterReimbursementMutation(queryClient)` to
`apps/mobile/lib/transactions/invalidate.ts` — invalidates `['transactions']`,
`['accounts']`, `['dashboard']`, `['cards']` (a statement confirm lands on a
card period). Called from the block's success handler, never inside the mutator.

## Web re-point (behavior-preserving)

`confirmReimbursement` / `cancelReimbursement` in
`apps/web/app/_actions/reimbursements.ts` become thin wrappers: auth + client +
delegate to the package fn + `revalidateAfterReimbursementMutation()` on ok.
Proof: `apps/web/lib/transactions/__tests__/reimbursements.test.ts` stays green
with no test edits (the seam moved, the behavior didn't).

## i18n

Keys already exist under `transactions.reimbursement.pending.*` (title,
subtitle, real_amount, real_date, confirming, confirmed_success,
cancelled_success) and `reimbursement.confirm` / `.cancel` /
`errors.amount_positive`. Expect **zero to near-zero** new keys — verify the
destructive cancel-confirm dialog copy exists, add it if not.

## Scope calls (settled)

- **Feed-only v1.** Movimientos tab gets the actionable block; the account-detail
  card stays read-only (follow-up, noted as deferral).
- **One change.** Extract + mobile shell + feed block ship together — the block
  can't work without the extraction, same bundling as the recurring hub.
