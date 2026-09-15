---
name: grana-suggest-branch-and-commit
description: Analyze uncommitted local changes and propose 3 branch names plus 3 concise commit titles, following the repo's branching convention and conventional-commits style.
user_invocable: true
allowed-tools: Bash
---

# Suggest branch name and commit title

Inspect the repo's pending local changes and propose naming options the user can pick from.

## Steps

1. Gather the change context with these commands (run them in parallel):
   - `git status` — see staged, unstaged, and untracked files (never use `-uall`).
   - `git diff` — unstaged changes.
   - `git diff --staged` — staged changes.
   - `git log -n 10 --oneline` — match the repo's existing commit style.

2. If there are no changes at all (clean working tree, nothing staged), tell the user and stop — do not invent suggestions.

3. Analyze the diff to determine:
   - The **type** of change: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `style`, `perf`.
   - The **scope**: an app (`web`, `mobile`), a workspace package (`money-logic`, `ui-contracts`, `validation`, …), or a module (`auth`, `dashboard`, `cards`, `recurrences`, `i18n`, `supabase`, `openspec`, …). Match the scopes already used in `git log`.
   - The **intent** — the *why*, not just the *what*. Read the diff carefully; don't just list filenames.

4. Produce exactly **3 branch name suggestions**, following the repo convention (AGENTS.md, "Branching"):
   - Prefix: `feature/` for new functionality, `bugfix/` for bug fixes, `hotfix/` for urgent prod fixes, `chore/` for tooling/maintenance.
   - Body: short, kebab-case, descriptive, **in English**. Avoid generic names like `feature/updates`.
   - Never append random IDs, hashes, or arbitrary numeric suffixes — not even to dodge a name collision.
   - **Optional leading issue number** (`<prefix>/<issue-number>-<kebab-case>`, e.g. `feature/31-movement-form-mobile`): include it when the work traces to a GitHub issue. `/grana-create-pr` reads that number to fill the PR's `🔗 Ticket` section, which is what moves the issue to "Done" on merge. To find a candidate, run `gh issue list --state open --json number,title` and only use a number you can match to the diff — never invent one. If nothing matches, suggest plain names without a number.
   - Offer variation in framing (e.g., one scope-led, one outcome-led, one component-led) — not three near-duplicates.

5. Produce exactly **3 commit title suggestions**, following conventional-commits:
   - Format: `type(scope): description`
   - Keep under 72 characters.
   - Imperative mood ("add", "fix", "remove" — not "added", "fixes").
   - No trailing period.
   - Vary the angle so the user has a real choice.

6. Present the output in this exact format:

   ```
   ## Branch name suggestions
   1. feature/...
   2. bugfix/...
   3. chore/...

   ## Commit title suggestions
   1. feat(scope): ...
   2. fix(scope): ...
   3. refactor(scope): ...
   ```

   Add one short sentence at the end summarizing what the change is, so the user can sanity-check the analysis.

7. Do **not** create the branch, stage files, or commit. This skill only suggests names.
