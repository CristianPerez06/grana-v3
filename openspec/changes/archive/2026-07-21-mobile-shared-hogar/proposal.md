## Why

The "Hogar" (Compartido) tab is the last unbuilt primary tab on mobile: it is a locked, disabled "Próximamente" slot while the web app has a full five-route shared-household feature (setup, home, settings, settle, cuenta corriente). This is parity-backlog gap 3, and it is also the moment the codebase has been explicitly deferring the shared data layer for — the mobile stub `apps/mobile/lib/shared/queries.ts` documents itself as a temporary duplicate whose "extraction trigger" is exactly this: a second real consumer of the shared reads. Building Hogar on mobile and extracting `@grana/shared` are the same task.

## What Changes

- **Extract `@grana/shared`** — a new platform-agnostic package holding the shared-household reads (the 8 functions currently in `apps/web/lib/shared/queries.ts`, already parameterized by a `supabase` client) and the write mutator-cores (validate + RPC) pulled out of the web `'use server'` actions in `apps/web/app/_actions/shared.ts`.
- **Move the canonical `Household`/`HouseholdMember` types to `@grana/ui-contracts`**, collapsing the two byte-identical definitions (`apps/web/lib/shared/types.ts`, `packages/movement-form/src/types.ts`) into one.
- **Refactor web to consume the package** — server components import reads from `@grana/shared` directly; `apps/web/lib/shared/queries.ts` is deleted (no shim), consistent with the completed direct-reads rollout. Web server actions stay as the `'use server'` boundary but delegate to package mutators and keep `revalidatePath`.
- **Delete the mobile duplicate stub** (`getHousehold` + `getMovementSharedInfo` in `apps/mobile/lib/shared/queries.ts`); both platforms now use the package.
- **Enable the Hogar tab** on mobile (drop the `DisabledTab`/"Próximamente" treatment for `home`) and register the new pushed sub-routes in the TabBar chromeless detection.
- **Build the mobile Hogar module at full parity** — five screens: home (three states: no-household / waiting-for-member / active dashboard with month navigator), setup, settings (name + default-split drawers, leave-household dialog), settle (multi-step payer flow), and cuenta-corriente (ledger with currency toggle, filters, and settlement reverse/cancel write paths).

## Capabilities

### New Capabilities
- `shared-data-access`: the `@grana/shared` package — platform-agnostic reads (parameterized by a Supabase client) and write mutator-cores (validation + atomic RPC) for the shared-household domain, consumed by both web and mobile; canonical shared types home.

### Modified Capabilities
- `shared`: add `(mobile)` consumer requirements — the Compartido module renders on mobile at parity (home three states, setup, settings, settle, cuenta corriente). Domain rules (debt derivation, splitting, settlement, security) are unchanged; only the set of platforms that surface them grows.
- `mobile-app-shell`: the Hogar tab transitions from a disabled "Próximamente" slot to an enabled navigation tab now that `shared` is implemented on mobile.

## Impact

- **New package**: `packages/shared/` (`@grana/shared`). New workspace dependency for `apps/web` and `apps/mobile`.
- **Moved code**: `apps/web/lib/shared/queries.ts` (deleted), mutator-cores out of `apps/web/app/_actions/shared.ts` (delegated), `Household` types → `@grana/ui-contracts`.
- **Deleted**: mobile stub `apps/mobile/lib/shared/queries.ts` duplication.
- **New mobile screens/components**: `apps/mobile/app/(app)/home.tsx` + pushed routes under `shared/`; RN component mirrors (`BalanceCard`, `InviteCard`, `PendingSettlementCard`, `RecentSharedList`, `SetupForm`, settle/settings/ledger views).
- **Touched shell**: `apps/mobile/components/layout/TabBar.tsx` (enable Hogar, chromeless segments).
- **Unchanged**: Supabase schema and RPCs (`join_household_by_code`, `register_settlement`, `confirm_settlement`, `reverse_settlement`), domain math (`@grana/money-logic`), validation schemas (`@grana/validation`).
- **Constraint**: single React version across the monorepo (RN 0.81 pins 19.1.0) — the package must stay UI-free (types + logic only).
