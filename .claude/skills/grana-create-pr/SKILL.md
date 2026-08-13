---
name: grana-create-pr
description: Create a GitHub pull request for the current branch, with title and body auto-drafted from the commits ahead of main, following the repo's PR template.
user_invocable: true
allowed-tools: Bash
---

# Create PR

Open a GitHub pull request for the current branch. The title is drafted from the commits unique to `main`; the body follows `.github/PULL_REQUEST_TEMPLATE.md` section by section.

**The PR body is written in Spanish** — the template is in Spanish and repo documentation is in Spanish (AGENTS.md, "Language conventions"). The **title** stays in English conventional-commit format, like the commit it will become on squash merge.

## Preconditions

Stop and explain instead of guessing if any of these fails:

- `gh` CLI is installed and authenticated.
- Current branch is not `main` (PRs always come from a feature branch).
- There is at least one commit on the branch ahead of `main`.
- There isn't already an open PR for the current branch.

## Steps

1. **Verify `gh` is installed and authenticated** (must run first — everything else assumes `gh` works):

   ```bash
   gh --version >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
   ```

   If either check fails, STOP immediately and print this message verbatim (with all three platform instructions, since the user's OS isn't always known):

   > The `gh` CLI is not installed and/or not authenticated, so we cannot continue. Install and authenticate first:
   >
   > - **macOS**: `brew install gh && gh auth login`
   > - **Windows**: `winget install --id GitHub.cli` (or `choco install gh`), then `gh auth login`
   > - **Linux**: follow [https://github.com/cli/cli#installation](https://github.com/cli/cli#installation) for your distro, then `gh auth login`
   >
   > After authenticating, verify with `gh auth status` and re-run `/grana-create-pr`.

   Do not attempt to install `gh` yourself — let the user do it (auth is browser-interactive and varies per platform).

2. **Verify branch + branch state** (run in parallel):
   - `git branch --show-current`
   - `git status -sb`
   - `git log main..HEAD --pretty=format:'%H %s'`
   - `git diff main..HEAD --stat`
   - `gh pr list --head $(git branch --show-current) --json number,url 2>/dev/null`

   If `git branch --show-current` returns `main`, stop and explain.

   If `gh pr list` returns an existing PR, surface its URL and stop. Don't create a duplicate.

   If `git log main..HEAD` is empty, stop and tell the user the branch has no commits ahead of main.

3. **Handle uncommitted changes**: if `git status -sb` shows uncommitted files (modified, staged, or untracked that aren't gitignored):
   - List them.
   - Ask the user whether to commit them first (offer to invoke the `grana-suggest-branch-and-commit` skill), stash them, or proceed without them.
   - Do not silently include uncommitted work in the PR.

4. **Run the pre-merge validations** — see [Validations](#validations) below. This happens *before* pushing so a red branch never reaches the remote. If anything fails, STOP and report; do not create the PR.

5. **Ensure the branch is pushed**: if `git status -sb` shows the branch isn't tracking a remote, or shows commits ahead of origin, run `git push -u origin <current-branch>`.

6. **Synthesize the title**:
   - If exactly one commit on the branch: use its subject line verbatim (it should already follow conventional commit format).
   - If multiple commits: construct a single conventional-commit-style title that captures the dominant theme. Lean on the most substantive commit. Keep under 70 chars. Lowercase after the colon.
   - Strip trailing periods.

7. **Synthesize the body** — see [Body structure](#body-structure) below.

8. **Show the user the draft and confirm**:
   - Print the validation results (which checks ran, which passed).
   - Print the proposed title.
   - Print the proposed body.
   - Ask: "Create this PR?" — accept y/n or "edit" (in which case ask what to change and regenerate).

9. **On confirmation, create the PR**:

   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   Use a HEREDOC for the body to preserve formatting and avoid quote-escaping problems.

10. **Report the PR URL** back to the user as the final output.

## Validations

Run these before creating the PR. They mirror the five CI jobs in `.github/workflows/ci.yml` (`quality`, `web-build`, `web-test`, `monorepo-health`, `specs`), so a green local run means a green PR.

Order is fail-fast — cheapest first, so a lint error doesn't cost a full monorepo build:

```bash
pnpm lint && pnpm lint:mobile          # → quality
pnpm typecheck && pnpm typecheck:mobile # → quality
pnpm openspec:check                     # → specs
pnpm test                               # → web-test
pnpm build                              # → web-build
```

Rules:

- **Failure aborts.** Report which command failed with its output, and stop. Do not push, do not create the PR, do not offer to tick the box anyway.
- **Only tick what actually ran and passed.** This is not a formality: the `specs` job in `ci.yml` exists because "a checklist box was once ticked for a run that never happened". A tick in this repo is a claim about a command that produced exit code 0 in this session.
- **The user may skip explicitly** ("ya las corrí"). Then leave those boxes unticked and say so in the draft — never tick on someone's say-so.
- `pnpm install --frozen-lockfile` and the duplicate-`react` check only matter if the branch touched a `package.json` or `pnpm-lock.yaml`. Check with `git diff main..HEAD --name-only`; if untouched, omit those two lines from the checklist rather than ticking them.

## Body structure

One section per template heading. **Omit any section that doesn't apply** — an empty section is noise for the reviewer.

### 🎯 ¿Qué hace este PR?

Always present. 1–2 sentences on what the change does and why. Read the diff, not just the commit subjects — focus on intent, not a file recap.

### 🔗 Ticket

Infer from the branch name, which may carry a leading issue number (`<prefix>/<issue-number>-<kebab-case>`, see AGENTS.md "Branching"):

```bash
git branch --show-current | sed -nE 's|^[a-z]+/([0-9]+)-.*|\1|p'
```

- **Number found** → verify it's a real, open issue with `gh issue view <n> --json number,title,state`. If it resolves, emit `Ticket: #<n>`. If it doesn't (typo, or the number was a semantic suffix like `migration-step-2`), omit the section and mention it in your report.
- **No number** → omit the whole section. Do not ask the user for one; a branch with no issue behind it is normal.

This is what feeds `.github/workflows/ticket-to-done.yml` — the issue moves to "Done" in the Project on merge. No ticket here means nothing moves, which is the correct outcome for a PR with no ticket.

### 🧩 Tipo de cambio

Tick exactly one, from the dominant commit type on the branch:

| Commit types | Box |
| --- | --- |
| `fix` | 🐞 Bug fix |
| `feat` | 🧩 Feature nueva |
| `refactor`, `perf`, `style` | ⚙️ Mejora / Refactor |
| `docs` | 📄 Documentación |
| `ci`, `build`, `chore` | 🔧 Config / CI |
| any commit that moves `openspec/changes/` | 🗂️ OpenSpec |

Mixed branches: pick the type of the most substantive change, not the most frequent one.

### 📐 OpenSpec

Include **only** if `git diff main..HEAD --name-only` touches `openspec/`. Each box is verifiable — check it, don't assume:

- Archived in the branch → the diff shows files added under `openspec/changes/archive/YYYY-MM-DD-<name>/`.
- Deltas applied → `grep -rE '^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements' openspec/specs/` returns nothing.
- No `TBD` → covered by the `pnpm openspec:check` run from [Validations](#validations).
- `AGENTS.md` updated → only applicable if the change completes a module or adds a package; if it doesn't, drop the line instead of ticking it.

Fill `Change:` with the actual folder path.

### 📸 Screenshots / Videos

Include only if the diff touches UI files (`apps/web/app/`, `apps/web/components/`, `apps/mobile/`, `packages/ui-tokens/`). Leave the **Antes/Después** placeholders empty and tell the user in your report that they need to attach the images by hand — you cannot produce them, and per repo convention you don't run the app.

Omit entirely for backend/spec/config-only PRs.

### 🧪 Cómo probarlo

Concrete steps a reviewer can follow: route to open, action to take, expected result. Derive from the diff. For PRs with no runtime surface (specs, docs, CI), replace the numbered steps with a one-line note on what to review instead.

### ✅ Checklist previo al merge

Tick per [Validations](#validations) for the first block. For the other two blocks:

- **Arquitectura y convenciones** — tick only what you verified against the diff. If the diff can't violate an item (no user-facing strings added → the i18n item), tick it. If you're unsure, leave it unticked and raise it under *Notas para quien revisa*.
- **Higiene de rama** — the branch-name and rebase items are mechanically checkable (`git merge-base --is-ancestor main HEAD`). The squash-merge item describes something that hasn't happened yet: leave it unticked.

### 💬 Notas para quien revisa

Include only when there's something real: a trade-off taken, an open question, an unticked checklist item and why, a deliberate scope cut. Omit it rather than writing "nada que destacar".

## Conventions

- The repo's PR template is the source of truth for body structure. If it changes, follow it — the section list above tracks the template as of the `ticket-to-done` workflow being added.
- Body in Spanish, title in English. See AGENTS.md "Language conventions".
- If the branch is messy (many WIP commits, unclear messages), suggest the user squash + rewrite via `git rebase -i main` before creating the PR. A clean branch makes the body draft itself.

## Edge cases

- **`gh` not installed / not authenticated**: handled by Step 1 with the cross-platform install message.
- **No commits ahead of main**: stop. Tell the user the branch has nothing to PR.
- **Existing PR for this branch**: surface its URL instead of creating a duplicate.
- **Validations fail**: stop before pushing. The branch stays local and fixable without a red PR in the history.
- **Branch number that isn't an issue**: omit the Ticket section; don't guess a different issue.
- **Merge convention**: `main` has linear history — every unit of work lands as **one squashed commit**, and merge commits are rejected. Prefer **Squash and merge** on the PR. Squashing locally and pushing the single commit is equally acceptable (`git merge --squash <branch>` from `main`, or `git reset --soft main && git commit` on the branch). Do NOT use `git merge --no-ff` or "Create a merge commit" — see AGENTS.md "Merging to `main`" and the `project-conventions` requirement "Merge a main produce un único commit squasheado sobre historia lineal".
