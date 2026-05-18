# grana-v3monorepo

pnpm workspaces monorepo. Today `apps/web` (Next.js App Router) is the only app. `apps/mobile` is reserved for the Expo app and will be scaffolded in a separate change — do not create it here.

## V3 Rebuild Standard

Grana V3 is not a rewrite for its own sake. It is a rebuild whose goal is to make the product functionally explicit, technically reliable, and documented enough that a fresh LLM session can continue the app without relying on hidden chat context.

The repo is the memory. Important business decisions must be captured in specs, migrations, code, and tests where appropriate. If a rule matters to the accounting behavior of the app, do not leave it only in conversation history or implicit implementation.

## Repo Layout

```
apps/
  web/             # Next.js (App Router) — the only app today
packages/
  validation/      # @grana/validation       — Yup schemas + helpers (pure, cross-platform)
  i18n-messages/   # @grana/i18n-messages    — locale catalogs (JSON), no runtime
  supabase/        # @grana/supabase         — Database type slot + createClient factory
  ui-tokens/       # @grana/ui-tokens        — design tokens (CSS, single source for web)
supabase/          # SQL migrations + email templates (backend, NOT an app)
openspec/          # spec-driven workflow
```

### What goes where

- **`apps/<name>/`** — platform/deployment-specific code: routes, screens, middleware, server actions, components, Next/Expo config.
- **`packages/<name>/`** — code reusable across apps **with no platform deps**. If something only one app uses, it stays in that app.
- **Repo root** — orchestrator `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, meta files. **No product code at the root.**

When a module that lives in `apps/web/lib/` later needs to be reused by mobile, promote it to `packages/` rather than copying.

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
| **Off-ledger credit cards** | `account.type='credit'` transactions never reduce `disponible`. Only the statement payment — an `expense` posted on a cash/debit account — does. |
| **Derived balances** | No balance column anywhere. Always computed from transaction history. Never persisted. |
| **`disponible ≥ 0` invariant** | Must be enforced in **every write path** that can reduce available balance (expense, transfer, adjustment, confirm recurrence, pay card period, delete income). Clamping in reads is not enforcement — it just hides corruption. |
| **`Money` type + `decimal.js`** | All monetary arithmetic uses a `Money` branded type backed by `decimal.js`. Never use raw JS `+` `-` `*` `/` on money values. `NUMERIC(18,2)` in DB — never `FLOAT`. |
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

Build order matters — each module depends on the ones above it.

| # | Module | Status | Qué incluye |
|---|--------|--------|-------------|
| 1 | `auth` | ✅ Done | Registro, login, recupero de contraseña |
| 2 | `schema-base` | ✅ Done | Monedas, instituciones, redes de tarjeta, tipo `Money`, fecha contable y zona horaria financiera |
| 3 | `categories` | ✅ Done | 17 categorías sistema + subcategorías, categorías propias del usuario, i18n |
| 4 | `accounts` | ✅ Done | Cuentas efectivo (ARS/USD), cuentas bancarias/débito (tarjetas de crédito: ver módulo cards) |
| 5 | `transactions` | ✅ Done | Ingresos y gastos en cuentas cash/bank (transferencias, ajustes, cuotas y recurrencias: changes futuros) |
| 5.5 | `cards` | 🚧 In progress | Tarjetas de crédito: alta experto/novato, períodos (resúmenes), consumos, cuotas en pesos, pago de resumen, reversión |
| 6 | `shared` | 🔲 Planned | Gastos compartidos entre N personas ("Compartido"), deuda derivada, liquidación |
| 7 | `savings` | 🔲 Planned | Sistema de sobres (envelopes), enganche a ingresos — diseño pendiente |
| 8 | `cashflow` | 🔜 Future | Proyecciones de flujo de caja |
| 9 | `investments` | 🔜 Future | Inversiones |

**Dependencias:** `accounts` → `transactions` → `shared` y `savings`. No se puede implementar una sin la anterior.

**Specs viven en:** `openspec/specs/<module>/spec.md` una vez que el módulo se archiva.
| `investments` | `openspec/specs/investments/` | 🔜 Future |
