# grana-v3monorepo

pnpm workspaces monorepo. Today `apps/web` (Next.js App Router) is the only app. `apps/mobile` is reserved for the Expo app and will be scaffolded in a separate change — do not create it here.

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
