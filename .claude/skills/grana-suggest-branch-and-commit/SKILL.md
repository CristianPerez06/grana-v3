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
   - The **scope** (a feature folder under `features/`, a module like `scanner`, `auth`, `i18n`, etc.).
   - The **intent** — the *why*, not just the *what*. Read the diff carefully; don't just list filenames.

4. Produce exactly **3 branch name suggestions**, following the repo convention:
   - Prefix: `feature/` for new functionality, `bugfix/` for bug fixes, `hotfix/` for urgent prod fixes, `chore/` for tooling/maintenance.
   - Body: short, kebab-case, descriptive. Avoid generic names like `feature/updates`.
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
