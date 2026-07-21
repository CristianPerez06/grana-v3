## 1. Extract `@grana/shared` (data layer)

- [x] 1.1 Scaffold `packages/shared/` (`@grana/shared`, `workspace:*`) as a UI-free package (no `react` dep); wire tsconfig/build to match sibling logic packages
- [x] 1.2 Move `Household`/`HouseholdMember` types into `@grana/ui-contracts`; delete the definitions in `apps/web/lib/shared/types.ts` and `packages/movement-form/src/types.ts`; re-point `@grana/movement-form` to import from `@grana/ui-contracts`
- [x] 1.3 Move the 8 reads (`getHousehold`, `getHouseholdDebt`, `getHouseholdOutlook`, `getCurrentAccount`, `getPendingSettlements`, `getSharedAccruedMovements`, `getMovementSharedInfo`, `getSharedExpenses`) verbatim from `apps/web/lib/shared/queries.ts` into `@grana/shared` (keep `supabase` param signatures; keep `@grana/money-logic` delegation)
- [x] 1.4 Extract write mutator-cores (validate + RPC, typed result, no platform glue) for the 8 operations from `apps/web/app/_actions/shared.ts` into `@grana/shared`
- [x] 1.5 Move remaining shared types (debt/outlook/current-account/settlement/expense shapes) needed by reads into `@grana/shared`; export a clean public surface

## 2. Refactor web onto `@grana/shared`

- [x] 2.1 Re-point web server components to import reads from `@grana/shared` directly; delete `apps/web/lib/shared/queries.ts` (no shim)
- [x] 2.2 Rewrite `apps/web/app/_actions/shared.ts` server actions to delegate to package mutator-cores, keeping only `'use server'` + `revalidatePath` as glue
- [x] 2.3 Delete `apps/web/lib/shared/types.ts` leftovers; fix all web imports of `Household`/shared types to `@grana/ui-contracts` / `@grana/shared`

## 3. Retire the mobile stub + verify extraction

- [x] 3.1 Replace the duplicate bodies in `apps/mobile/lib/shared/queries.ts` with a thin wrapper that injects the native client into `@grana/shared` reads and keeps the app's signatures (same pattern as `lib/cards/queries.ts`); existing movement-form/detail consumers stay unchanged
- [x] 3.2 Verification gate: `pnpm` typecheck + lint pass across the workspace; web builds; `@grana/shared` has no `react` dependency; a manual web smoke of `/shared/*` still works (extraction is behavior-neutral before any mobile UI)

## 4. Enable the Hogar tab

- [x] 4.1 In `apps/mobile/components/layout/TabBar.tsx`, flip the `home` slot from `DisabledTab`/"Próximamente" to an enabled navigation tab
- [x] 4.2 Register the shared sub-route segments (`setup`, `settle`, `settings`, `cuenta-corriente`) in the TabBar chromeless detection so pushed screens hide the tab bar
- [x] 4.3 Add the Expo Router route files under `apps/mobile/app/(app)/` for the Hogar sub-screens (chromeless pushed routes)

## 5. Mobile Hogar home (3 states)

- [x] 5.1 Build `(app)/home.tsx` state resolution from `getHousehold` (no-household / waiting-member / active) with react-query + section-local loading/error and `PageHeader` chrome visible from first paint
- [x] 5.2 No-household state: RN `SetupForm` (create / join toggle) consuming the create/join mutator-cores
- [x] 5.3 Waiting-member state: RN `InviteCard` (generate code, copy, share) via `createInvite`
- [x] 5.4 Active state: `BalanceCard` (bimoneda debt fixed at "today", `toLocaleString('es-AR')`), month navigator governing spend/breakdown only, `PendingSettlementCard` (receiver assign-account), `RecentSharedList` (total protagonist + "Tu parte" secondary), settle CTA, settings icon, movement FAB — per the `shared` home requirements and the mobile design reference

## 6. Mobile settle flow

- [x] 6.1 Build the pushed `settle` screen: currency select (when owing in >1), `MoneyAmountInput`, quick chips (total/half), account picker with balances, before/after preview, non-blocking negative-balance warning
- [x] 6.2 Submit via `registerSettlement` mutator-core (result → `pending_receipt`), with react-query invalidation glue; wire receiver assign-account (`assignSettlementAccount`) from the home pending card

## 7. Mobile settings

- [x] 7.1 Build the pushed `settings` screen: household name (edit drawer), members list, invite section (if <2 members)
- [x] 7.2 Default-split editor drawer (first member editable 1..99%, second derived) via `updateHouseholdConfig`
- [x] 7.3 Leave-household dialog via `leaveHousehold` (blocked on debt / pending settlements / active shared recurrences), surfacing the block reason

## 8. Mobile cuenta-corriente ledger

- [x] 8.1 Build the pushed ledger screen from `getCurrentAccount`: currency toggle, expandable equation, filters (settlements-only / by person), entries with balance impact
- [x] 8.2 Wire write paths: revert completed settlement (`reverse_settlement`, contra-entry) and cancel pending (delete) via mutator-cores with inline confirm + react-query invalidation

## 9. Final verification

- [x] 9.1 Workspace typecheck + lint green; mobile app boots; Hogar tab reachable
- [x] 9.2 Manual mobile walkthrough of all three home states + settle + settings + ledger against the `shared` spec scenarios and the mobile design reference
- [x] 9.3 Confirm no duplicate `Household` type, no residual `apps/web/lib/shared/queries.ts`, and `apps/mobile/lib/shared/queries.ts` holds only thin `@grana/shared` wrappers (no reimplemented read bodies)
