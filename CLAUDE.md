# Next.js Project

This is a Next.js project using the App Router architecture.

## Tech Stack

- Next.js with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- React Server Components by default

## Project Structure

- `app/` - App Router pages and layouts
- `components/` - Reusable React components
- `lib/` - Utility functions and shared code
- `public/` - Static assets
- `supabase/migrations/` - SQL migrations (run manually in the Supabase SQL Editor)
- `supabase/templates/` - Email templates (source of truth — see "Email templates" below)

## Conventions

- Use Server Components by default, add 'use client' only when needed
- Prefer named exports for components
- Use TypeScript strict mode
- Follow the Next.js file-based routing conventions
- Use next/image for optimized images
- Use next/link for client-side navigation

## Code Style

- Use functional components with TypeScript
- Prefer async/await over .then() chains
- Use early returns for cleaner code
- Keep components small and focused

## Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint

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
- **Code is in English** (identifiers, file/dir names, code comments, JSDoc/TSDoc, Storybook story names). The only exception is the *values* of strings in `lib/i18n/messages/*.json`, which are user-facing copy.
- **Commit messages are in English**, following conventional commits (`type(scope): subject`).
- **This file (`CLAUDE.md`) stays in English** by design — it's an LLM system-prompt extension.
- **OpenSpec parser keywords stay in English** even inside Spanish specs (`### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**`, `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`, `FROM:`, `TO:`).
