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
  validation/      # @grana/validation       — Yup schemas + helpers (pure, cross-platform)
  i18n-messages/   # @grana/i18n-messages    — locale catalogs (JSON), no runtime
  supabase/        # @grana/supabase         — Database type slot + createClient factory
  ui-tokens/       # @grana/ui-tokens        — design tokens (CSS variables, shared web+mobile)
  dashboard/       # @grana/dashboard        — dashboard queries + pure aggregations
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
- Pure business logic (balance calculation, period derivation, recurrence date generation) lives in `packages/money-logic/` and is consumed by both apps. No duplicate calculation code in `apps/<name>/lib/`.
- Naming convention: interaction callbacks are named `onPress` (RN-friendly) on both sides — not `onClick`. Other naming conventions are documented in `packages/ui-contracts/README.md`.
- Supabase queries stay in each app's `lib/` because they depend on each app's Supabase client wrapper. Only the pure functions move to `packages/`.

## Tech Stack (apps/web)

- Next.js with App Router, TypeScript strict, Tailwind CSS v4, React Server Components by default.

## Conventions

- Server Components by default; `'use client'` only when needed.
- Named exports for components.
- next/image for images, next/link for client-side navigation.
- Functional components, async/await, early returns, small focused components.
- **Code is in English** (see "Language conventions" below).

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

### Pre-commit check — MANDATORY

**Before every `git commit`, run `git branch --show-current`.** If the output is `main`, STOP. Do not commit. Create a feature branch first:

```bash
git checkout -b <prefix>/<kebab-name>
# then commit normally
```

No exceptions. This check is non-negotiable even when the user says "commit this" without specifying a branch.

### Merging to `main`

`main` keeps a **linear history**: one commit per feature/fix/chore, no merge commits.

- A branch being merged into `main` MUST have exactly **one commit** on top of `main` at merge time. If your branch has N > 1 commits, squash them locally first (`git rebase -i main` with fixups, or `git reset --soft main && git commit`).
- The merge MUST use `git merge --ff-only`. Never use `--no-ff`, never use `--squash` as the merge command, never accept an auto-generated `Merge branch '...'` commit.
- If `main` moved while you were working, rebase your branch onto `main` first (`git rebase main`), resolve conflicts, then merge with `--ff-only`.
- This applies to humans and to LLMs collaborating autonomously. The pre-existing merge commits in `main`'s history are NOT rewritten; the rule applies going forward.

Happy-path example (branch has 3 commits, `main` moved):

```bash
git checkout my-branch
git rebase -i main           # squash the 3 commits into 1 (rebase onto main as a bonus)
git checkout main
git pull --ff-only origin main
git merge --ff-only my-branch
git push origin main
```

## OpenSpec — workflow obligatorio

The repo uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven changes. Active changes live in `openspec/changes/<name>/`; archived changes in `openspec/changes/archive/YYYY-MM-DD-<name>/`; master specs in `openspec/specs/<capability>/spec.md`.

### Archive happens in the branch, before merge to main

When a change implementation is complete, archive it as the **last commit of the working branch, before the `--ff-only` merge to `main`**. Not after. This keeps the merge atomic: in a single commit `main` receives the code, the updated master specs, the completed `Purpose` fields, and the consequent `CLAUDE.md` edits.

### Post-archive checklist — MANDATORY before merge

When archiving a change:

1. Move the folder from `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`.
2. For each capability touched by the change, open `openspec/specs/<capability>/spec.md` and:
   - Apply the deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) so they are integrated into the flat `## Requirements` section. The master spec MUST NOT contain delta sections.
   - Replace any `Purpose: TBD - created by archiving change ...` placeholder with a real 2-4 line `Purpose` describing the capability's scope.
3. Update `CLAUDE.md` when applicable:
   - Section "Modules" if the change completes or adds a module.
   - Section "Repo Layout" if the change adds a package or app.
4. Run `pnpm openspec:check`. It MUST pass before the merge.

### Pre-change check

Before starting a new change, verify no other active change in `openspec/changes/` touches the same capability. If one does, decide ordering and dependencies before starting the new one.

### `pnpm openspec:check`

The script fails if any master spec under `openspec/specs/` contains the placeholder `TBD - created by archiving` or a literal `Purpose: TBD`. It is the merge-gate for spec hygiene — humans and LLMs alike. Run it as part of the pre-merge checklist; CI may enforce it in the future.

## Email templates

- Supabase email templates used by the app live versioned under `supabase/templates/` (`confirm-signup.html`, `reset-password.html`). The repo is the **source of truth**; the Supabase dashboard is a manual mirror until we adopt the Supabase CLI.
- When you change a template: edit the file in the repo, commit, then paste the new content into the matching field in the Supabase dashboard. Never the other way around.
- The `<a href="...">` URLs inside each template MUST match what `/auth/callback` expects:
  - `confirm-signup.html` → `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
  - `reset-password.html` → `{{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password`
- Do not use the default `{{ .ConfirmationURL }}` helper for the recovery template — it omits `next=/reset-password` and breaks the recovery flow.
- Subjects still live only in the dashboard for now; they'll be versioned when we adopt the Supabase CLI.

## Language conventions

- **Project documentation is in Spanish** (`README.md`, `SUPABASE_SETUP.md`, every `openspec/changes/**/*.md` and `openspec/specs/**/*.md`).
- **Code is in English** (identifiers, file/dir names, code comments, JSDoc/TSDoc, Storybook story names). The only exception is the *values* of strings in `packages/i18n-messages/src/*.json`, which are user-facing copy.
- **Commit messages are in English**, following conventional commits (`type(scope): subject`).
- **This file (`CLAUDE.md`) stays in English** by design — it's an LLM system-prompt extension.
- **OpenSpec parser keywords stay in English** even inside Spanish specs (`### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**`, `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`, `FROM:`, `TO:`).

## Domain — Grana

Personal finance app for the Argentine market. Built by an accountant for people who need real financial control in a two-currency environment (ARS + USD).

**Three pillars:** accounting trust (numbers are correct, nothing hidden), own personality (not a bank, not a spreadsheet), pedagogy without condescension (the app suggests and teaches, never talks down).

**Key differentials:** credit card installment tracking as a first-class citizen; bi-currency daily life (Argentines save in USD, spend in both); inflation context.

**User modes:** `novato` — simplified UI, default accounts hidden, answers "how much do I have / where did it go / what came in?"; `experto` — full app, adds "where exactly is that money?" with account-level detail. Mode is stored in `users.mode` and is **UI-only** — server actions do not enforce it.

### Cross-cutting principles

These affect every feature. Not knowing them causes silent bugs anywhere in the codebase.

| Principle | Rule |
|-----------|------|
| **Bimoneda** | ARS and USD are separate ledgers. Never convert automatically. ARS is always primary (large type); USD is subordinate (smaller, labeled). Totals are always shown per currency, never merged. |
| **Bimoneda por defecto** | Every user is provisioned with ARS *and* USD enabled at signup; the default `Billetera` cash account is created with both currencies, and any account created during onboarding (e.g. a bank account) also gets both. Onboarding never asks "do you use dollars?". Hiding USD is an opt-out preference in `settings` (future change), implemented as a UI-only flag — it must not remove rows from `account_currencies` nor mutate the ledger. Complementary to (not a replacement for) the **Bimoneda** principle above. |
| **Off-ledger credit cards** | `account.type='credit'` transactions never reduce `disponible`. Only the statement payment — an `expense` posted on a cash/debit account — does. |
| **Derived balances** | No balance column anywhere. Always computed from transaction history. Never persisted. |
| **Negative balance allowed + soft warning** | `disponible` MAY go negative — it reflects reality (overdrafts, out-of-order entries). No write path blocks or clamps it, and the negative balance is shown as-is (clamping in reads is forbidden — it hides the truth). Instead, any operation that would push `disponible` below 0 (expense, transfer-out, negative adjustment, confirm recurrence, pay card statement) MUST surface a **non-blocking warning** before confirmation: it informs, it does not prevent the entry. Credit cards are off-ledger and never trigger it. This is a deliberate evolution from grana-v2, which hard-blocked the operation (invariant I-AH-1). |
| **`Money` type + `decimal.js`** | All monetary arithmetic uses a `Money` branded type backed by `decimal.js`. Never use raw JS `+` `-` `*` `/` on money values. `NUMERIC(18,2)` in DB — never `FLOAT`. |
| **Money inputs use `MoneyAmountInput`** | All money-amount form fields MUST use `@/components/ui/money-amount-input.tsx` (`type="text" inputMode="decimal"` under the hood) — never raw `<input type="number">` for currency. Reason: `type="number"` reacts to mouse wheel, arrow keys and spinner buttons; each nudge does `value − step` in IEEE 754, so a focused `3000` with `step="0.01"` becomes `2999.99` silently. Parsing/validation still goes through `parseMoneyInput`. |
| **Accounting dates + financial timezone** | Financial `date` fields are accounting dates stored as `DATE` without timezone. `created_at` is the technical audit instant stored as `TIMESTAMPTZ`; never use it as a financial date. Any "today" default in financial operations must be computed from the user's financial timezone, not the server/browser timezone. V3 defaults that timezone to `America/Argentina/Buenos_Aires`, represented today by `getTodayAR()`. Raw `new Date()` causes date corruption near midnight and must not be used directly for financial "today". |
| **Deterministic ordering** | Transaction ordering depends on use: **calculation queries** (balance, running totals) use `ORDER BY date ASC, created_at ASC, id ASC`; **display queries** (lists shown to users) use `ORDER BY date DESC, created_at DESC, id DESC`. Never mix them up — using ASC for display shows oldest first; using DESC for balance breaks running totals. |
| **Mother/child installments** | A credit card purchase in N installments = 1 parent row (`is_parent=true`, `account_id=NULL`, `status=NULL`) + N child rows (`status='pending'`, `account_id=card`). Children go `pending → paid` when the period is paid — never `posted`. |
| **I-CRED-1: credit initial balance = 0** | `account.type='credit'` must always have `initial_balance=0` on all its `account_currencies` rows. Enforced by DB trigger `trg_fn_credit_initial_balance`. |
| **I-CRED-6: credit expense → period required** | Every `expense` on a credit account must have `card_period_id NOT NULL` and `status IN ('pending','paid')`. Enforced by DB trigger `trg_fn_credit_transaction_invariants`. |
| **I-CRED-9: installments ARS only** | `installments_total > 1` is only allowed when `currency_code = 'ARS'`. Enforced by CHECK constraint `chk_installments_ars_only`. |
| **I-CRED-11: fx_rate_to_ars iff credit+non-ARS** | `fx_rate_to_ars` must be NOT NULL when `account.type='credit'` AND `currency_code != 'ARS'`, and NULL otherwise. Enforced by trigger. |
| **I-CRED-12: at least 1 open period** | Each active credit card must always have ≥1 period with state 'open' or 'closed' (i.e., unpaid in the future). Rolling automático creates estimated periods on demand. |
| **Migrations are the schema truth** | No `schema.sql` reference file. The source of truth is the ordered migration files in `supabase/migrations/` + the generated `packages/supabase/src/types.ts`. |
| **Supabase is online-only** | There is no local Supabase instance and there never will be. Migrations are applied by pasting SQL into the Supabase dashboard SQL Editor. Types are regenerated with `supabase gen types typescript --project-id <id>` against the remote project. Any task or spec that says "local DB" means the online Supabase project. |

### Modules

Build order matters — each module generally depends on the ones above it. Cross-cutting modules (`schema-base`, `profiles`, `i18n`, `card-networks`, `project-conventions`) underpin everything else.

| # | Module | Status | Qué incluye |
|---|--------|--------|-------------|
| 1 | `auth` | ✅ Done | Registro, login, recupero de contraseña, OTP, callbacks |
| 2 | `schema-base` | ✅ Done | Monedas, instituciones, redes de tarjeta, tipo `Money`, fecha contable y zona horaria financiera |
| 3 | `profiles` | ✅ Done | Perfil del usuario, modo novato/experto, zona horaria financiera, flag de onboarding |
| 4 | `card-networks` | ✅ Done | Catálogo de redes de tarjeta con BIN ranges y branding |
| 5 | `categories` | ✅ Done | 17 categorías sistema + subcategorías, categorías propias del usuario, i18n |
| 6 | `i18n` | ✅ Done | Estrategia de mensajes (next-intl + helper RN), catálogos JSON compartidos, fallback |
| 7 | `accounts` | ✅ Done | Cuentas efectivo (ARS/USD), cuentas bancarias/débito (las de crédito viven en `cards`) |
| 8 | `transactions` | ✅ Done | Ingresos, gastos, transferencias, ajustes; reglas de balance |
| 9 | `cards` | ✅ Done | Tarjetas de crédito: alta experto/novato, períodos (resúmenes), consumos, cuotas en pesos, pago de resumen, reversión |
| 10 | `recurring-movements` | ✅ Done | Plantillas de recurrencias e instancias generadas; confirmar, saltar, posponer |
| 11 | `dashboard` | ✅ Done | Landing universal post-login: Hero "Para gastar", Lo que viene, Balance del mes, Tarjetas |
| 12 | `onboarding` | ✅ Done | Wizard post-signup (web + mobile), bimoneda default, gate logic |
| 13 | `mobile-app-shell` | ✅ Done | Expo app shell, navegación tabs, gating de auth y onboarding, presentación visual del tab bar y `AppMenu` |
| 13b | `web-app-shell` | ✅ Done | Shell de navegación web: sidebar island único, paleta de marca, drawer mobile-first bajo `md`, estado activo derivado de la ruta |
| 13c | `route-loading-and-errors` | ✅ Done | Componentes `Spinner` y `RouteError` (web + mobile) con API compartida vía `@grana/ui-contracts`. Web: `loading.tsx`/`error.tsx` por layout group de Next App Router. Mobile: TanStack Query como seam de fetching cliente (provider en root, refetch on focus integrado via `AppState`). |
| 13d | `page-header` | ✅ Done | Componente `PageHeader` (web + mobile) con contract compartido `PageHeaderProps` (`title`, `description?`, `backLink?`, `actions?`) en `@grana/ui-contracts`. Estilo canónico de título de página (`text-2xl font-semibold tracking-tight`). Anti-regresión: prohíbe `<h1>` ad-hoc en pages, salvo headers compuestos de detalle (`DashboardHeader`, `AccountDetailHeader`, `CardHero`, `TransactionDetailHeader`) y wizard de onboarding. |
| 14 | `settings` | ✅ Done | Categorías personalizadas, preferencias de usuario (mostrar centavos, etc.) + paridad mobile (toggle centavos, switcher de idioma reactivo via `LocaleProvider`, CRUD de categorías en mobile) |
| 15 | `shared` | 🔲 Planned | Gastos compartidos entre N personas ("Compartido"), deuda derivada, liquidación |
| 16 | `savings` | 🔲 Planned | Sistema de sobres (envelopes), enganche a ingresos — diseño pendiente |
| 17 | `cashflow` | 🔜 Future | Proyecciones de flujo de caja |
| 18 | `investments` | 🔜 Future | Inversiones |

**Dependencias clave:** `accounts` → `transactions` → `shared` y `savings`. `cards` y `recurring-movements` se apoyan en `transactions`. `dashboard` y `onboarding` consumen casi todo lo anterior.

**Specs viven en:** `openspec/specs/<module>/spec.md` una vez que el módulo se archiva.
