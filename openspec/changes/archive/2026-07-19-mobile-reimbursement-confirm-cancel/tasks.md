# Tasks — mobile reimbursement confirm/cancel

## 1. Extract confirm/cancel into `@grana/transactions-mutations`

- [x] 1.1 Add `confirmReimbursement(supabase, userId, input)` to
      `packages/transactions-mutations/src/thin-mutations.ts`: validate with
      `confirmReimbursementSchema`, fetch the row, guard (not found / not a
      reimbursement / cancelled / received), build the update (received_at +
      normalized amount + date), and for `statement` resolve the period via the
      already-imported `getOrCreatePeriodForDate` and reject a paid period —
      logic lifted verbatim from the web action.
- [x] 1.2 Add `cancelReimbursement(supabase, userId, input)`: validate with
      `cancelReimbursementSchema`, guard (not found / not a reimbursement /
      already received), idempotent on already-cancelled, set `cancelled_at`.
- [x] 1.3 Export both from `packages/transactions-mutations/src/index.ts`.

## 2. Re-point the web actions to thin wrappers

- [x] 2.1 Rewrite `confirmReimbursement` / `cancelReimbursement` in
      `apps/web/app/_actions/reimbursements.ts` as auth + client + delegate to
      the package fn + `revalidateAfterReimbursementMutation()` on ok. Drop the
      now-unused inline imports (`getOrCreatePeriodForDate`, `getTodayAR`,
      `normalizeMoneyAmount`, the schemas) that moved into the package.
- [x] 2.2 Run `apps/web/lib/transactions/__tests__/reimbursements.test.ts` —
      must stay green with no test changes (behavior-preservation proof).

## 3. Mobile mutators + invalidation

- [x] 3.1 Add `invalidateAfterReimbursementMutation(queryClient)` to
      `apps/mobile/lib/transactions/invalidate.ts` (invalidate `transactions`,
      `accounts`, `dashboard`, `cards`).
- [x] 3.2 Add `confirmReimbursement(input, t)` / `cancelReimbursement(input, t)`
      shells to `apps/mobile/lib/transactions/mutators.ts`: resolve auth,
      delegate to the package impls, degrade a Spanish-only guard `formError`
      to a localized generic message (mirror the recurrence mutators'
      `localize`).

## 4. Native pending-reimbursements block

- [x] 4.1 Create
      `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`:
      thin consumer of `getPendingReimbursements(supabase)` (global), rendering
      nothing when empty; a titled block ("Reintegros a confirmar") above the
      list, sibling of `PendingRecurrencesBlock`.
- [x] 4.2 Per-row **inline-expand** confirm: title + estimated amount; a
      "Confirmar" affordance that expands `MoneyAmountInput` (default =
      estimated) + `DateField` (default = expenseDate ?? today), then commits
      `{ id, amount, date }`. Per-row busy + inline error + transient success.
- [x] 4.3 "Cancelar" → `Alert.alert` destructive confirm →
      `cancelReimbursement`. On success, call
      `invalidateAfterReimbursementMutation`.
- [x] 4.4 Mount the block on the Movimientos feed
      (`apps/mobile/app/(app)/transactions/index.tsx`) above `MovementList`,
      next to `PendingRecurrencesBlock`; pass `todayISO` for the date default.

## 5. i18n

- [x] 5.1 Confirm `transactions.reimbursement.pending.*` +
      `reimbursement.confirm` / `.cancel` / `errors.amount_positive` cover the
      native copy; add only the destructive cancel-confirm dialog keys if
      missing (es + en).

## 6. Validate

- [x] 6.1 `openspec validate mobile-reimbursement-confirm-cancel --strict`.
- [x] 6.2 Web: typecheck + lint + the reimbursements test suite green.
- [x] 6.3 Mobile: typecheck + lint green.
