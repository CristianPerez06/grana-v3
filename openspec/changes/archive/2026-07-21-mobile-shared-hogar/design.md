## Context

The Compartido (shared household) feature is fully built on web across five routes (`/shared`, `/shared/setup`, `/shared/settings`, `/shared/settle`, `/shared/cuenta-corriente`) and fully specified in the `shared` capability. On mobile it does not exist: the Hogar tab is a disabled "Próximamente" slot and `(app)/home.tsx` returns `null`.

The reason it has been deferred is a data-layer one. The domain **math** (`@grana/money-logic/src/shared.ts`) and **validation** (`@grana/validation/src/shared.ts`) are already shared packages, but the actual reads and write orchestration are still web-local:

- Reads live in `apps/web/lib/shared/queries.ts` (8 functions, each already parameterized by a `supabase` client).
- Writes live in `apps/web/app/_actions/shared.ts` (8 `'use server'` actions wrapping validation + atomic Supabase RPC).

Mobile carries a deliberate temporary duplicate (`apps/mobile/lib/shared/queries.ts`) with `getHousehold` + `getMovementSharedInfo` narrowed to what the movement form needs. Its own comment names this change as the extraction trigger: the second real consumer. So the mobile module and the `@grana/shared` extraction are one change, per the user's decision to bundle them.

Constraints: single React version across the monorepo (RN 0.81 pins 19.1.0) — any new shared package must stay UI-free. Mobile tabs are locked (Inicio / Movimientos / Hogar / Menú). Money is formatted inline on mobile via `toLocaleString('es-AR')`, not via `@grana/i18n-messages`. Cross-platform components share names and public props but each platform implements idiomatically.

## Goals / Non-Goals

**Goals:**
- Extract `@grana/shared` (reads + write mutator-cores + canonical types wiring) and refactor web to consume it, deleting the web query layer and the mobile stub duplicate.
- Bring the mobile Hogar module to full parity with web: all five screens including the cuenta-corriente ledger and its write paths.
- Keep the extraction independently verifiable (web green) before any mobile screen work.

**Non-Goals:**
- No change to the Supabase schema, RLS policies, or RPCs.
- No change to the domain rules (debt derivation, splitting, settlement, security) — those stay in the `shared` spec; this change only adds the mobile surface and the data-access capability.
- No new tab, no reordering of tabs.
- No cross-platform extraction of money formatting (mobile keeps its `toLocaleString` idiom).
- No expansion beyond two household members (Phase 1 scope stays).

## Decisions

### Decision 1: Canonical `Household` type moves to `@grana/ui-contracts`

`Household`/`HouseholdMember` are currently defined twice — byte-identically — in `apps/web/lib/shared/types.ts` and `packages/movement-form/src/types.ts`. They collapse into a single definition in `@grana/ui-contracts`, imported by `@grana/shared`, `@grana/movement-form`, web and mobile.

- **Alternative: put the type in `@grana/shared`.** Rejected — `@grana/movement-form` would then depend on a *feature* package just to render the "Compartir" toggle, inverting the dependency direction (a lower-level form package depending on a higher-level domain package).
- **Alternative: leave it in `@grana/movement-form`.** Rejected — the shared-household domain owning its core type inside a form package is an odd home and couples the domain to the form.
- `@grana/ui-contracts` is the existing neutral "shapes shared cross-package/cross-platform" home and is already a dependency of both movement-form and the apps, so no cycle is introduced.

### Decision 2: `@grana/shared` = reads + mutator-cores + no UI, and web consumes it directly

The package exports the 8 reads (moved verbatim, they already take a `supabase` param) and write mutator-cores that do **validation + RPC only** and return a typed result — no `revalidatePath`, no react-query, no redirects. Platform glue stays in the consumer, exactly like `@grana/transactions-mutations`:

```
@grana/shared (UI-free)
  reads(supabase, …)  ───────────────┐
  mutatorCore(supabase, input) ──┐    │
                                 │    │
   web server action  ('use server')  web server component
     → mutatorCore + revalidatePath     → read directly
   mobile handler                       mobile screen
     → mutatorCore + invalidateQueries    → read via react-query
```

- Web server components import reads from `@grana/shared` **directly**; `apps/web/lib/shared/queries.ts` is **deleted** (no shim), consistent with the completed direct-reads rollout that deleted `app/_actions/queries.ts`.
- Web server actions in `app/_actions/shared.ts` stay as the `'use server'` boundary but delegate their core to the package and keep only `revalidatePath`.
- **Alternative: keep `apps/web/lib/shared/queries.ts` as a re-export shim.** Rejected — the direct-reads rollout established that shims are debt; call sites re-point to the package.

### Decision 3: Full parity in one change, extraction-first ordering

The change delivers all five screens including the cuenta-corriente ledger (which carries `reverse_settlement` / cancel write paths). To keep a large diff tractable and resumable, `tasks.md` sequences the extraction as a self-contained, independently verifiable block (package builds, web consumes it, both stub and web-query layer deleted, typecheck/lint/web green) **before** any mobile screen. Mobile screens then land in dependency order: enable tab → home (3 states) → settle → settings → cuenta-corriente, each verifiable on its own.

### Decision 4: Mobile chrome and navigation follow existing patterns

Home is a tab (tab bar visible); setup/settle/settings/cuenta-corriente are pushed chromeless routes with their segments registered in `TabBar` chromeless detection, mirroring `/transactions/new` and `/cards/[id]`. Screens use `PageHeader` with always-visible chrome (back-link + action slots from first paint, disabled until data resolves — never hidden behind a skeleton) and `SafeAreaView edges={['top']}`. Drawers/sheets reuse existing primitives (`Drawer`, `SelectSheet`, `Popover`, `Segmented`, `MoneyAmountInput`) — no new UI infrastructure. Components mirror web names (`BalanceCard`, `InviteCard`, `PendingSettlementCard`, `RecentSharedList`, `SetupForm`) with RN-idiomatic implementations. Design reference: `docs/design/shared/mobile/monthly-outlook-v11-claude-final.html`, translated to tokens (never literal hex).

## Risks / Trade-offs

- **Large, cross-cutting diff (web refactor + 5 RN screens in one change)** → Extraction-first task ordering with a verification gate before mobile work; each screen independently verifiable so the change can be paused/resumed cleanly.
- **Web regression during extraction (deleting the query layer + moving types touches many call sites)** → Land and verify the extraction (typecheck + lint + web smoke) before touching mobile; the reads move verbatim (same signatures) to minimize behavioral change.
- **`Household` type move ripples through `@grana/movement-form`, which is already shipping** → The two definitions are byte-identical, so the move is import-only; verify movement-form consumers (web + mobile) typecheck after re-pointing.
- **`@grana/shared` accidentally pulling in React/UI and duplicating React** → Spec forbids UI in the package; keep it types + logic only, verified by inspecting its dependencies.
- **Ledger write paths inside a "read" screen (reverse/cancel settlement)** → Reuse the same mutator-cores the web ledger uses; treat the ledger's writes as first-class, not an afterthought.

## Open Questions

- None blocking. Month-navigator state on mobile Hogar can follow the existing `DashboardMonthContext` pattern or a screen-local equivalent — an implementation choice to settle during the home-screen task, not a spec-level decision.
