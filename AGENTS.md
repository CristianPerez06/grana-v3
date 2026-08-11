# grana-v3monorepo

pnpm workspaces monorepo with two apps: `apps/web` (Next.js App Router) and `apps/mobile` (Expo). Mobile mirrors web feature-by-feature with parallel native implementations sharing typed prop contracts via `@grana/ui-contracts` and pure business logic via `@grana/money-logic` (see "Web ↔ Mobile policy" below).

## V3 Rebuild Standard

Grana V3 is not a rewrite for its own sake. It is a rebuild whose goal is to make the product functionally explicit, technically reliable, and documented enough that a fresh LLM session can continue the app without relying on hidden chat context.

The repo is the memory. Important business decisions must be captured in specs, migrations, code, and tests where appropriate. If a rule matters to the accounting behavior of the app, do not leave it only in conversation history or implicit implementation.

## Repo Layout

```
apps/
  web/             # Next.js (App Router) — web app
  mobile/          # Expo — mobile app (mirrors web feature-by-feature)
packages/
  validation/            # @grana/validation             — Yup schemas + helpers (pure, cross-platform)
  i18n-messages/         # @grana/i18n-messages          — locale catalogs (JSON), no runtime
  supabase/              # @grana/supabase               — Database type slot + createClient factory
  ui-tokens/             # @grana/ui-tokens              — design tokens (CSS variables, shared web+mobile)
  dashboard/             # @grana/dashboard              — dashboard queries + pure aggregations
  transactions-mutations/# @grana/transactions-mutations — orquestadores write-path con rollback (installments / card purchase / recurrence-from-movement); reciben un cliente Supabase autenticado, no hacen cache invalidation
  movement-form/         # @grana/movement-form          — hook React `useMovementForm` (estado, cascadas, submit dispatcher) + tipo top-level `Mutators` que web y mobile bindean a sus actions
supabase/          # SQL migrations + email templates (backend, NOT an app)
openspec/          # spec-driven workflow
```

### What goes where

- **`apps/<name>/`** — platform/deployment-specific code: routes, screens, middleware, server actions, components, Next/Expo config.
- **`packages/<name>/`** — code reusable across apps **with no platform deps**. If something only one app uses, it stays in that app.
- **Repo root** — orchestrator `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, meta files. **No product code at the root.**

When a module that lives in `apps/web/lib/` later needs to be reused by mobile, promote it to `packages/` rather than copying.

### Web ↔ Mobile policy

Two native implementations, one shared API.

- Each primitive UI component (`Button`, `Card`, `Input`, etc.) has a separate implementation in `apps/web/components/ui/` (HTML primitives) and `apps/mobile/components/ui/` (React Native primitives). **JSX is not shared between web and React Native** — `<div>` does not exist in RN, `<View>` does not exist in web.
- Parity is guaranteed by **shared prop types** in `packages/ui-contracts/`. Both apps import the same `ButtonProps`, `CardProps`, etc. Divergence in prop names, types or semantics breaks TypeScript on the other side.
- Pure business logic (balance calculation, period derivation, recurrence date generation) lives in `packages/money-logic/` and is consumed by both apps. Pure **view-model** logic of a domain (grouping, urgency/tone, presentation, row mappers) lives in that domain's package (`@grana/cards`, `@grana/accounts`, …). No duplicate, hand-synced logic in `apps/<name>/lib/` — the "Mirror of … keep in sync" pattern is prohibited.
- Naming convention: interaction callbacks are named `onPress` (RN-friendly) on both sides — not `onClick`. Other naming conventions are documented in `packages/ui-contracts/README.md`.
- The `apps/` ↔ `packages/` boundary is decided by **platform coupling, not by whether code touches Supabase**. Isomorphic logic moves to `@grana/<domain>`: pure functions **and** reads parameterized by an injected client (`supabase: GranaSupabaseClient`, `today` injected — no `next/*`, no `server-only`, no client construction). Only platform-coupled glue stays per app: `next/cache` revalidation, `server-only`/client construction, `'use server'` shells that translate errors, and RSC data assembly. See spec `web-data-access` for the read-slice pattern.

### Component layering (UI)

UI components sit in three tiers by reusability. Each tier has a canonical location per platform:

1. **UI primitives** — the most basic building blocks (`Button`, `Card`, `Input`, `FormField`, `PasswordField`, `Alert`, `Spinner`, …). Live in `apps/web/components/ui/` and `apps/mobile/components/ui/`, one implementation per platform, props shared via `@grana/ui-contracts`. Web primitives have a Storybook story; mobile has no Storybook and mirrors them by name. **Equivalent screens MUST use the equivalent primitive on each platform** — e.g. a password field uses `PasswordField` (with a show/hide toggle), never a raw input with `secureTextEntry`.
2. **Composed components** — reusable across routes but not generic enough for `ui/` (no Storybook). Two kinds:
   - **App / route-group shells:** `apps/<app>/components/layout/` (`AuthShell`, `TabBar`, `AppMenu`). Location matches across platforms.
   - **Feature-shared:** shared across routes *within* a feature. Web colocates them under the route group at `apps/web/app/(group)/_components/` (Next.js ignores `_`-prefixed dirs). Mobile CANNOT colocate under `app/` (Expo Router treats `app/` as routes), so they live at `apps/mobile/components/<feature>/` (e.g. `components/auth/OtpVerifyForm.tsx`). This location asymmetry is router-driven and does NOT violate the Web ↔ Mobile policy — that policy bans sharing JSX and requires API parity via contracts, not identical folder paths.
3. **Route/screen-local** — single-use, colocated with the route (`login/login-form.tsx` on web; inlined into the screen on mobile).

#### Mobile form surfaces — never compose the chrome by hand

Any `apps/mobile` surface with a text input MUST get its scroll container from `components/layout/`, never from a hand-rolled `ScrollView`. Otherwise the keyboard covers the focused field, and nothing in CI catches it (see spec `mobile-app-shell`):

- **Pushed form screen** → `FormScreen`. It composes `PageHeader` + a keyboard-aware scroller; the screen passes `title`/`backLink` and its content. Do NOT rebuild the `View > PageHeader > ScrollView` triple.
- **Overlay with form content** (`Drawer`, `BottomSheet`, `Modal`) → `FormSheetBody`. An RN `Modal` renders into its own native window, so it mounts its own nested `KeyboardProvider` — the root one does not reach inside.
- **Overlay that already owns a `FlatList`** → `FormSheetKeyboardView`. Using `FormSheetBody` there would nest a VirtualizedList inside a ScrollView.
- **Anything else needing the scroller directly** (a tab root that must keep a sibling FAB) → import `KeyboardAwareScrollView` from `components/layout/keyboard-aware-scroll-view`, **never** straight from `react-native-keyboard-controller`. That module registers the component with NativeWind; without it `className`/`contentContainerClassName` are silently dropped and the screen loses all padding. TypeScript does not catch this — NativeWind augments `ScrollViewProps` globally.

`KeyboardAvoidingView` from `react-native` is banned in `apps/mobile`: it does not scroll the focused field into view and is unreliable on Android under edge-to-edge.

## Tech Stack (apps/web)

- Next.js with App Router, TypeScript strict, Tailwind CSS v4, React Server Components by default.

## Conventions

- Server Components by default; `'use client'` only when needed.
- Named exports for components.
- next/image for images, next/link for client-side navigation.
- Functional components, async/await, early returns, small focused components.
- **Code is in English** (see "Language conventions" below).

### Route rendering model

Pick the rendering model from the **shape of the route's interactivity**, not from a global preference:

- **Read-only routes** (dashboard, card detail, settings views) → **RSC + `<Suspense>` per section**. The route's `page.tsx` composes async server components; each section's data lives in `lib/<feature>/queries.ts` and is awaited inside its container; loading/error states live in the boundary of each section (see spec `route-loading-and-errors`).
- **Interactive routes** (lots of client-side filters / search / toggles that the user mutates without navigating) → **client shell + `<QueryClientProvider>` + `useQuery`**. The `page.tsx` stays a thin server shell that resolves auth + terminal guards (`notFound`, `redirect`); everything else mounts under a client component. Filters live in React state (`useReducer` + context, no URL params; the shared `FiltersProvider` lives in `lib/transactions/filters-context.tsx`). Mutations call invalidation helpers from `lib/<feature>/invalidation.ts`; server actions also call `revalidatePath` helpers from `app/_actions/_helpers.ts` so other RSC routes stay fresh on next navigation. `/transactions` and `/accounts/[id]` are the reference implementations.

The **data layer is one** in both models: query functions live in `lib/<feature>/queries.ts` and are **client-agnostic** — they take the Supabase client as their first parameter (`(supabase: DbClient, …)`, see `lib/supabase/db-client.ts`) and never import `@/lib/supabase/server` (that would drag `next/headers` into client bundles). RSC callers pass the server client; client components call them **directly with the browser client** (`lib/supabase/client.ts`) via TanStack — RLS is the authorization boundary (see spec `web-data-access`). Composite/hot reads are Postgres RPCs (e.g. `get_movements_page`, `get_account_balance_sums`). Server actions are for **mutations only**; the read wrappers left in `app/_actions/queries.ts` are legacy for not-yet-migrated routes — do not add new ones.

## Commands

All scripts work from the repo root (orchestrator forwards to `pnpm --filter web ...`) or from `apps/web/`.

- `pnpm dev` — Next dev server (web)
- `pnpm build` — production build (web)
- `pnpm lint` — ESLint (web)
- `pnpm storybook` — Storybook on :6006 (web)
- `pnpm --filter web <script>` — explicit form if you ever add another app

## Shared packages — TypeScript paths to source

Packages under `packages/<name>/` have **no build step**. Their `package.json` `main`/`exports` point directly at `src/index.ts`. Next resolves them via `transpilePackages` in `apps/web/next.config.ts`, and TS resolves the `@grana/*` aliases via `paths` declared in `tsconfig.base.json` (extended by `apps/web/tsconfig.json`).

Consequences:

- Editing a package shows up immediately in web (no rebuild step).
- Any new package must be added both to `transpilePackages` in `apps/web/next.config.ts` and to `paths` in `tsconfig.base.json` + `apps/web/tsconfig.json`.
- If a future Metro/Expo setup can't resolve TS through workspaces cleanly, the fix is to add a build step to the affected package only — not a repo-wide change.

## Specs — cross-platform convention

When a behavior exists on multiple platforms, write **one capability per business behavior** with a platform-neutral name (`auth`, `dashboard`, …). Inside it:

- Scenarios identical across platforms have no tag.
- Scenarios that diverge are tagged at the end of the name: `(web)` / `(mobile)`.

Capabilities that are genuinely single-platform get a prefix: `web-middleware-routing`, `mobile-push-notifications`. Meta capabilities like `project-conventions` stay unprefixed. Full rules in the `project-conventions` spec.

## Branching

- `main` — main development branch
- `feature/*`, `bugfix/*`, `hotfix/*`, `chore/*` — work branches
- Branch names follow `<prefix>/<descriptive-kebab-case>`. The body MUST be a meaningful identifier in English.
- The body MUST NOT include random IDs, hashes, or arbitrary numeric suffixes — even when an LLM creates the branch autonomously and might be tempted to add one to avoid collisions.
  - ✓ `feature/add-login-form`, `chore/cleanup-storybook`, `bugfix/race-condition`
  - ✗ `feature/add-login-form-xA43I`, `chore/cleanup-7b3f9`
- Semantically meaningful suffixes are allowed (they carry meaning, not randomness): `feature/migration-step-2`, `bugfix/race-condition-v2`, `chore/cleanup-rollback`.
- An issue number MAY be prefixed to the body as `<prefix>/<issue-number>-<descriptive-kebab-case>`. This is the **only** allowed numeric identifier, and it is not arbitrary: `/grana-create-pr` reads it to fill the `🔗 Ticket` section of the PR, which is what drives the `ticket-to-done` workflow after merge. It stays optional — a branch with no issue behind it takes no number.
  - ✓ `feature/31-movement-form-mobile`, `bugfix/29-usd-negative-balance`
  - ✗ `feature/movement-form-mobile-31` (trailing → indistinguishable from an arbitrary suffix)

### Pre-commit check — MANDATORY

**Before every `git commit`, run `git branch --show-current`.** If the output is `main`, STOP. Do not commit. Create a feature branch first:

```bash
git checkout -b <prefix>/<kebab-name>
# then commit normally
```

No exceptions. This check is non-negotiable even when the user says "commit this" without specifying a branch.

### Merging to `main`

`main` has linear history enforced. Every feature/fix/chore lands as **one squashed commit** on top of the previous one. No merge commits exist on `main` going forward.

The **method** for producing that result is up to whoever merges. Acceptable paths:

- Click **Squash and merge** on the PR (easiest path, recommended for non-dev contributors).
- Squash locally and push the resulting single commit (e.g. `git merge --squash <branch>` from `main`, or `git reset --soft main && git commit` on the branch, then push).
- Any other sequence that produces a single squashed commit on linear history and that GitHub's branch protection accepts.

Not acceptable (rejected by branch protection):

- Merge commits (`git merge --no-ff`, "Create a merge commit" on GitHub).
- "Rebase and merge" or `git rebase main` + push of N commits — preserves intermediate commits on `main` and breaks "one commit per unit of work".

Other rules:

- The commit message that lands on `main` MUST be **title only — no body, no trailers** per the general commit rule. Conventional commits format (`type(scope): subject`).
- The branch can have any number of commits during the work — WIP, fixups, mid-apply corrections, anything. They all collapse on merge.
- LLMs collaborating autonomously MUST NOT merge to `main` — the existing "the user does the merge" rule stands. LLMs leave the branch in the right state (work done, archive applied, `pnpm openspec:check` passing) and stop; the user picks the method.
- The pre-existing `--no-ff` merge commits and fast-forward merges in `main`'s history are NOT rewritten; the rule applies going forward.

**Required GitHub branch protection on `main`** (these are what enforce the invariants mechanically):

- Require linear history → ON
- Allow merge commits → OFF
- Allow squash merging → ON, default commit title "Pull request title", default commit body blank
- Allow rebase merging → OFF

## OpenSpec — workflow obligatorio

The repo uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven changes. Active changes live in `openspec/changes/<name>/`; archived changes in `openspec/changes/archive/YYYY-MM-DD-<name>/`; master specs in `openspec/specs/<capability>/spec.md`.

### Archive happens in the branch, before merge to main

When a change implementation is complete, archive it on the working branch **before** the merge to `main`, regardless of merge method. The branch as a whole MUST contain the archive (folder moved, master specs synced, `Purpose` completed, `AGENTS.md` updated when applicable) at merge time, so that the single squashed commit that lands on `main` carries those edits. Do not defer the archive to a follow-up PR.

### Post-archive checklist — MANDATORY before merge

When archiving a change:

1. Move the folder from `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`.
2. For each capability touched by the change, open `openspec/specs/<capability>/spec.md` and:
   - Apply the deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) so they are integrated into the flat `## Requirements` section. The master spec MUST NOT contain delta sections.
   - Replace any `Purpose: TBD - created by archiving change ...` placeholder with a real 2-4 line `Purpose` describing the capability's scope.
3. Update `AGENTS.md` when applicable:
   - Section "Modules" if the change completes or adds a module.
   - Section "Repo Layout" if the change adds a package or app.
4. Run `pnpm openspec:check` locally on the branch. It MUST pass before the merge to `main`.

### Pre-change check

Before starting a new change, verify no other active change in `openspec/changes/` touches the same capability. If one does, decide ordering and dependencies before starting the new one.

### `pnpm openspec:check`

The script fails if any master spec under `openspec/specs/` contains the placeholder `TBD - created by archiving` or a literal `Purpose: TBD`. It is the merge-gate for spec hygiene — humans and LLMs alike. Run it as part of the pre-merge checklist; CI may enforce it in the future.

## Email templates

- Supabase email templates used by the app live versioned under `supabase/templates/` (`confirm-signup.html`, `reset-password.html`). The repo is the **source of truth**; the Supabase dashboard is a manual mirror until we adopt the Supabase CLI.
- When you change a template: edit the file in the repo, commit, then paste the new content into the matching field in the Supabase dashboard. Never the other way around.
- **The auth flow is OTP, not magic links.** Both templates render an 8-digit code via `{{ .Token }}` — never a confirmation link. There is no `/auth/callback` route in the app; do not add one, and do not reintroduce `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, `token_hash`/`code`/`next` query params, or any `<a href="...">` link into the templates. The code is what the user reads off the email and types into the in-app verify screen.
  - `confirm-signup.html` → code from `{{ .Token }}`, verified by `supabase.auth.verifyOtp({ type: 'signup' })` in `apps/web/app/(auth)/_components/otp-verify-form.tsx`. Resend uses `supabase.auth.resend({ type: 'signup' })`.
  - `reset-password.html` → code from `{{ .Token }}`, verified by `verifyOtp({ type: 'recovery' })`. The email is sent by `requestPasswordResetAction` (`app/_actions/request-password-reset.ts`), which **intentionally omits `redirectTo`** so there is no link to follow — only the code. Resend uses `supabase.auth.resetPasswordForEmail(email)`.
- Subjects still live only in the dashboard for now; they'll be versioned when we adopt the Supabase CLI.

## Language conventions

- **Project documentation is in Spanish** (`README.md`, `SUPABASE_SETUP.md`, every `openspec/changes/**/*.md` and `openspec/specs/**/*.md`).
- **Code is in English** (identifiers, file/dir names, code comments, JSDoc/TSDoc, Storybook story names). The only exception is the *values* of strings in `packages/i18n-messages/src/*.json`, which are user-facing copy.
- **Commit messages are in English**, following conventional commits (`type(scope): subject`). **Title only — no body, no trailers** (no explanation paragraph, no `Co-Authored-By`, no `🤖 Generated with…`). If something needs more context, put it in the PR description, not the commit. The commit title must stand alone.
- **This file (`AGENTS.md`) stays in English** by design — it's an LLM system-prompt extension.
- **OpenSpec parser keywords stay in English** even inside Spanish specs (`### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**`, `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`, `FROM:`, `TO:`).

## Domain — Grana

Personal finance app for the Argentine market. Built by an accountant for people who need real financial control in a two-currency environment (ARS + USD).

**Three pillars:** accounting trust (numbers are correct, nothing hidden), own personality (not a bank, not a spreadsheet), pedagogy without condescension (the app suggests and teaches, never talks down).

**Key differentials:** credit card installment tracking as a first-class citizen; bi-currency daily life (Argentines save in USD, spend in both); inflation context.

**Single profile (no user modes):** every user gets the same app — there is no `novato`/`experto` flag. Depth follows from data, not a stored mode: a user who keeps everything in the default `Billetera` gets the simple experience (with a single account, account-level detail like the account filter/column stays hidden); creating more accounts surfaces the account dimension ("where exactly is that money?"). The accounts list shows a dismissible first-use hint explaining the choice. (The old `profiles.mode` flag was removed in the `remove-user-modes` change — do not reintroduce it.)

### Cross-cutting principles

These affect every feature. Not knowing them causes silent bugs anywhere in the codebase.

| Principle | Rule |
|-----------|------|
| **Bimoneda** | ARS and USD are separate ledgers. Never convert automatically. ARS is always primary (large type); USD is subordinate (smaller, labeled). Totals are always shown per currency, never merged. |
| **Bimoneda por defecto** | Every user is provisioned with ARS *and* USD enabled at signup; the default `Billetera` cash account is created with both currencies, and any account created during onboarding (e.g. a bank account) also gets both. Onboarding never asks "do you use dollars?". Hiding USD is an opt-out preference in `settings` (future change), implemented as a UI-only flag — it must not remove rows from `account_currencies` nor mutate the ledger. Complementary to (not a replacement for) the **Bimoneda** principle above. |
| **Off-ledger credit cards** | `account.type='credit'` transactions never reduce `disponible`. Only the statement payment — an `expense` posted on a cash/debit account — does. |
| **Derived balances** | No balance column anywhere. Always computed from transaction history. Never persisted. The aggregation runs **in Postgres** (`get_account_balance_sums`, migration 0051), not by pulling the ledger into JS: a `.select()` of detail rows is silently capped by PostgREST's `max-rows` and yields a plausible-but-wrong number. Any read whose product is a money number must be complete by construction — aggregate in SQL, or paginate `.range()` exhaustively over a deterministic order. `calculateTransactionSums` (`@grana/money-logic`) remains the source of truth for the per-type sign rules; the SQL mirrors it and a parity test pins the equivalence. See spec `web-data-access`. |
| **Temporal cut: the future is not a fact** | A movement dated after today exists and is visible in lists, but never reaches a number that answers "what do I have" or "what did I spend". The balance cuts in SQL (`get_account_balance_sums`, migration 0052); the MONTH lenses (Balance del mes, ¿En qué gasté? + its drills, De dónde vino) cut via query predicate. The cut is **CAJA-scoped**: on-ledger rows (`status IS NULL`) are cut at today, card rows (`status` 'pending'/'paid') are NOT — the devengado unit is the month, so a cuota dated the 20th accrues from day 1. The rule lives once in `@grana/money-logic/temporal-cut.ts` (`cajaCutOrFilter`, `countsUnderTemporalCut`); reads derive it, never retype it. `hoy` is always the AR financial date, injected as a parameter — never a server clock (Supabase runs UTC and would move the boundary by 3 hours). Skipping this is what made a month of unconfirmed recurrences read as −$1.992.744 already spent. See specs `dashboard`, `spending-by-category`, `web-data-access`. |
| **"Cuenta propia" is defined once, in SQL** | The universe that makes up `disponible` — `type IN ('cash','bank') AND is_active = true` — lives in `get_owned_account_ids()` (migration 0051). Reads derive it from there; they do NOT rebuild the predicate. Hand-copying it already caused a real divergence (the month series omitted `is_active` while the Hero applied it, so an archived account moved the month net without moving the Disponible). It lives in SQL and not in a TS helper because the package graph runs `@grana/accounts → @grana/cards → @grana/transactions → @grana/dashboard`, so dashboard cannot import accounts. |
| **Negative balance allowed + soft warning** | `disponible` MAY go negative — it reflects reality (overdrafts, out-of-order entries). No write path blocks or clamps it, and the negative balance is shown as-is (clamping in reads is forbidden — it hides the truth). Instead, any operation that would push `disponible` below 0 (expense, transfer-out, negative adjustment, confirm recurrence, pay card statement) MUST surface a **non-blocking warning** before confirmation: it informs, it does not prevent the entry. Credit cards are off-ledger and never trigger it. This is a deliberate evolution from grana-v2, which hard-blocked the operation (invariant I-AH-1). |
| **`Money` type + `decimal.js`** | All monetary arithmetic uses a `Money` branded type backed by `decimal.js`. Never use raw JS `+` `-` `*` `/` on money values. `NUMERIC(18,2)` in DB — never `FLOAT`. |
| **Money inputs use `MoneyAmountInput`** | All money-amount form fields MUST use `@/components/ui/money-amount-input.tsx` (`type="text" inputMode="decimal"` under the hood) — never raw `<input type="number">` for currency. Reason: `type="number"` reacts to mouse wheel, arrow keys and spinner buttons; each nudge does `value − step` in IEEE 754, so a focused `3000` with `step="0.01"` becomes `2999.99` silently. Parsing/validation still goes through `parseMoneyInput`. |
| **Actions use the `Button` primitive** | Every button-like action (primary/secondary/ghost/destructive CTA, or a link styled as a button) MUST compose the `Button` primitive (`@/components/ui/button.tsx`) — never re-type `bg-primary`/`bg-emerald rounded-* px-* py-* font-…` inline on a `<button>` or `<Link>`. When the action navigates, use `<Button asChild><Link href=…>…</Link></Button>`. This is the action twin of the "card surfaces compose `Card`" rule. Inline navigation links treated as text (breadcrumbs, "Ver todo →", admin-footer links) and a primitive's own internal controls (`Segmented`, `Switch`) are NOT buttons and don't need `Button`. |
| **Accounting dates + financial timezone** | Financial `date` fields are accounting dates stored as `DATE` without timezone. `created_at` is the technical audit instant stored as `TIMESTAMPTZ`; never use it as a financial date. Any "today" default in financial operations must be computed from the user's financial timezone, not the server/browser timezone. V3 defaults that timezone to `America/Argentina/Buenos_Aires`, represented today by `getTodayAR()`. Raw `new Date()` causes date corruption near midnight and must not be used directly for financial "today". |
| **Deterministic ordering** | Transaction ordering depends on use: **calculation queries** (balance, running totals) use `ORDER BY date ASC, created_at ASC, id ASC`; **display queries** (lists shown to users) use `ORDER BY date DESC, created_at DESC, id DESC`. Never mix them up — using ASC for display shows oldest first; using DESC for balance breaks running totals. |
| **Mother/child installments** | A credit card purchase in N installments = 1 parent row (`is_parent=true`, `account_id=NULL`, `status=NULL`) + N child rows (`status='pending'`, `account_id=card`). Children go `pending → paid` when the period is paid — never `posted`. |
| **Reintegros / cashback** | A reimbursement is `transaction_type='reimbursement'` linked to its origin expense via `linked_transaction_id` (it **derives** the expense's category — stores none — and is **never** `income`). `received_at IS NULL` = pending (an expectation: never affects balances, lives in a "Reintegros a confirmar" block, NOT the history); set = received (a fact, enters balances). `cancelled_at` set = cancelled (mutually exclusive with received). `reimbursement_target='account'` credits a cash/bank account on receipt; `'statement'` reduces the card period total (off-ledger until the statement is paid). `estimated_amount` is immutable (what the user expected). Integrity enforced by `trg_fn_reimbursement_invariants`. |
| **Shared expenses & debt (Compartido)** | A shared expense is a **real** transaction (`is_shared=true` + `household_id`) plus per-member `shared_expense_split` rows (installments split on the children). The debt between the two members is **derived** per currency (sum of expense splits − received reimbursement splits − settlements), never persisted. A reimbursement on a shared expense inherits the split. Settling a debt creates two `transaction_type='settlement'` legs (`settlement_direction='out'` debits the payer, `'in'` credits the receiver) — they hit `disponible` but are excluded from spending/income analytics. RLS: a member may SELECT shared rows of their household (first cross-user read in v3); writes stay owner-only; a completed settlement is reverted via the `reverse_settlement` SECURITY DEFINER function. |
| **I-CRED-1: credit initial balance = 0** | `account.type='credit'` must always have `initial_balance=0` on all its `account_currencies` rows. Enforced by DB trigger `trg_fn_credit_initial_balance`. |
| **I-CRED-6: credit expense → period required** | Every `expense` on a credit account must have `card_period_id NOT NULL` and `status IN ('pending','paid')`. Enforced by DB trigger `trg_fn_credit_transaction_invariants`. |
| **I-CRED-9: installments ARS only** | `installments_total > 1` is only allowed when `currency_code = 'ARS'`. Enforced by CHECK constraint `chk_installments_ars_only`. |
| **I-CRED-11: fx_rate_to_ars iff credit+non-ARS** | `fx_rate_to_ars` must be NOT NULL when `account.type='credit'` AND `currency_code != 'ARS'`, and NULL otherwise. Enforced by trigger. |
| **I-CRED-12: at least 1 open period** | Each active credit card must always have ≥1 period with state 'open' or 'closed' (i.e., unpaid in the future). Rolling automático creates estimated periods on demand. |
| **Migrations are the schema truth** | No `schema.sql` reference file. The source of truth is the ordered migration files in `supabase/migrations/` + the generated `packages/supabase/src/types.ts`. |
| **Supabase is online-only** | There is no local Supabase instance and there never will be. Migrations are applied by pasting SQL into the Supabase dashboard SQL Editor. Types are regenerated with `supabase gen types typescript --project-id <id>` against the remote project. Any task or spec that says "local DB" means the online Supabase project. |

### Modules

Build order matters — each module generally depends on the ones above it. Cross-cutting modules (`schema-base`, `profiles`, `i18n`, `card-networks`, `project-conventions`, `repo-architecture`, `ui-foundations`) underpin everything else.

The table below tracks **product modules** in build order. Meta capabilities — `project-conventions`, `repo-architecture`, `ui-foundations` — deliberately have no rows: they describe how the repo is worked on, architected and styled rather than a shippable slice of product, so a "Status" column is meaningless for them. Find them in `openspec/specs/` instead.

| # | Module | Status | Qué incluye |
|---|--------|--------|-------------|
| 1 | `auth` | ✅ Done | Registro, login, recupero de contraseña, OTP, callbacks |
| 2 | `schema-base` | ✅ Done | Monedas, instituciones, redes de tarjeta, tipo `Money`, fecha contable y zona horaria financiera |
| 3 | `profiles` | ✅ Done | Perfil del usuario, zona horaria financiera, flag de onboarding |
| 4 | `card-networks` | ✅ Done | Catálogo de redes de tarjeta con BIN ranges y branding |
| 5 | `categories` | ✅ Done | 18 categorías sistema + subcategorías, categorías propias del usuario, i18n |
| 6 | `i18n` | ✅ Done | Estrategia de mensajes (next-intl + helper RN), catálogos JSON compartidos, fallback |
| 7 | `accounts` | ✅ Done | Cuentas efectivo (ARS/USD), cuentas bancarias/débito (las de crédito viven en `cards`) |
| 8 | `transactions` | ✅ Done | Ingresos, gastos, transferencias, ajustes, cambios de moneda, reintegros/cashback; reglas de balance |
| 9 | `cards` | ✅ Done | Tarjetas de crédito: alta de tarjeta (4 fechas), períodos (resúmenes), consumos, cuotas en pesos, pago de resumen, reversión |
| 10 | `recurring-movements` | ✅ Done | Plantillas de recurrencias e instancias generadas; confirmar, saltar, posponer |
| 11 | `dashboard` | ✅ Done | Landing universal post-login, idéntica en web y nativo (rediseño `redesign-dashboard-home` + paridad `dashboard-mobile-parity`): "Para gastar · hoy" (card navy) + "Dónde está" (cuentas), "Balance del mes" (neto + barras + strip USD), "En qué se fue" (dona ARS/USD); selector de mes compartido en el header. Tarjetas NO vive en el dashboard: el resumen vive en `/cards` |
| 12 | `onboarding` | ✅ Done | Wizard post-signup (web + mobile), bimoneda default, gate logic |
| 13 | `mobile-app-shell` | ✅ Done | Expo app shell, navegación tabs, gating de auth y onboarding, presentación visual del tab bar y `AppMenu` |
| 13b | `web-app-shell` | ✅ Done | Shell de navegación web: sidebar island único, paleta de marca, drawer mobile-first bajo `md`, estado activo derivado de la ruta |
| 13c | `route-loading-and-errors` | ✅ Done | Componentes `Spinner` y `RouteError` (web + mobile) con API compartida vía `@grana/ui-contracts`. Web: `loading.tsx`/`error.tsx` por layout group de Next App Router. Mobile: TanStack Query como seam de fetching cliente (provider en root, refetch on focus integrado via `AppState`). |
| 13d | `page-header` | ✅ Done | Componente `PageHeader` (web + mobile) con contract compartido `PageHeaderProps` (`title`, `description?`, `backLink?`, `actions?`) en `@grana/ui-contracts`. Estilo canónico de título de página (`text-2xl font-semibold tracking-tight`). Anti-regresión: prohíbe `<h1>` ad-hoc en pages, salvo headers compuestos de detalle (`DashboardHeader`, `AccountDetailHeader`, `CardHero`, `TransactionDetailHeader`) y wizard de onboarding. |
| 13e | `overlay-primitives` | ✅ Done | Primitivos UI de overlay (web + mobile) con contracts compartidos en `@grana/ui-contracts`: `Drawer` (panel lateral sobre scrim), `Popover` (contenido anclado / sheet en mobile), `Segmented` (selector de opción única) y `Switch` (on/off). Web sobre Radix; mobile sobre primitivos RN. Base del drawer de `redesign-movement-form-as-drawer`. |
| 14 | `settings` | ✅ Done | Categorías personalizadas, preferencias de usuario (mostrar centavos, etc.) + paridad mobile (toggle centavos, switcher de idioma reactivo via `LocaleProvider`, CRUD de categorías en mobile) |
| 14b | `spending-by-category` | ✅ Done | "En qué se fue": desglose de gastos del mes por categoría (donut SVG + ranking, neto = gastos − reintegros recibidos, por moneda con toggle ARS/USD), como carta de presentación de `/transactions` con drill-down al listado + navegación por mes unificada; teaser top-3 en el dashboard |
| 15 | `shared` | ✅ Done (web) | "Compartido": hogar de 2 miembros (invitación por código), gasto compartido como transacción real + split por % (efectivo/débito/tarjeta/cuotas), reintegro compartido que hereda el split, deuda **derivada por moneda**, liquidación con handshake liviano (tipo de movimiento `settlement`). Primer caso de **lectura cruzada entre usuarios** (RLS por hogar; escritura solo del dueño). Paridad mobile DIFERIDA (mobile carece de form de gastos nativo) |
| 16 | `savings` | 🔲 Planned | Sistema de sobres (envelopes), enganche a ingresos — diseño pendiente |
| 17 | `cashflow` | 🔜 Future | Proyecciones de flujo de caja |
| 18 | `investments` | 🔜 Future | Inversiones |

**Dependencias clave:** `accounts` → `transactions` → `shared` y `savings`. `cards` y `recurring-movements` se apoyan en `transactions`. `dashboard` y `onboarding` consumen casi todo lo anterior.

**Specs viven en:** `openspec/specs/<module>/spec.md` una vez que el módulo se archiva.
