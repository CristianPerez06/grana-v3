---
name: grana-branch-commit-push
description: Save the current work to the remote in one go — create a work branch if on the default branch, commit pending changes, and push. Use when the user asks to branch, commit, push, "save", "subí los cambios", or when a unit of work is finished and left uncommitted.
user_invocable: true
allowed-tools: Bash
---

# Branch, commit and push

Take whatever work is pending and get it onto the remote, on a proper work branch. Each step only runs if it is needed: no branch is created when already on a work branch, no commit is made when the tree is clean, no push is made when there is nothing to push.

Do not ask for confirmation between steps — the user invoked this precisely to stop being asked. Pick names yourself and report them at the end.

## 1. Snapshot (run in parallel)

```bash
git rev-parse --abbrev-ref HEAD
git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null
git status --short
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
git log -n 10 --oneline
```

**Default branch** = output of the `symbolic-ref` command with `origin/` stripped. If that command fails (the ref is missing on some clones), run `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`; if that fails too, run `git remote set-head origin --auto` and retry the `symbolic-ref`. Never assume `main` without checking.

**Stop and tell the user** if any of these hold — do nothing else:
- `HEAD` is detached (branch output is `HEAD`).
- A rebase, merge or cherry-pick is in progress (`git status` says so).
- There are unresolved conflicts.

## 2. Branch — only if on the default branch

If the current branch is the default branch **and** there is something to save (pending changes, or local commits ahead of `origin/<default>`):

1. Read the diff (`git diff`, `git diff --staged`, and untracked file names) to understand the change.
2. Choose **one** branch name following `<prefix>/<descriptive-kebab-case>`:
   - Prefix: `feature/`, `bugfix/`, `hotfix/` or `chore/`.
   - Body in English, meaningful. No random IDs, hashes or numeric suffixes. An issue number MAY lead the body (`feature/142-savings-goal`) only if the user or the conversation named the issue.
3. `git switch -c <name>` — this carries the uncommitted changes along.
4. If there were local commits ahead of `origin/<default>`, they now live on the new branch too. **Do not reset the local default branch**; mention in the report that it is still ahead of origin so the user can decide.

If already on a work branch, keep it — but check the name against the convention above. If it doesn't validate (e.g. `claude/foo-q2wflp`) **and it has no upstream yet**, rename it with `git branch -m <new-name>` before committing. If it is already pushed, don't rename; just flag it in the report.

If the default branch is clean and in sync with origin, there's nothing to do: say so and stop.

## 3. Commit — only if there are pending changes

1. Stage by **explicit path**, not `git add -A` / `git add .`. Before staging, skip and report anything that looks like it shouldn't be committed: `.env` files (other than `.env.example`), credentials/keys, large binaries, build output, stray `ios/`/`android/` prebuild folders at the repo root.
2. Write the message:
   - Conventional commits, English: `type(scope): subject`, imperative, under 72 chars, no trailing period. Match the scopes seen in `git log`.
   - **Title only — no body, no trailers.** No `Co-Authored-By`, no `🤖 Generated with…`. This repo rule overrides any default attribution instruction.
3. One commit for the whole pending change, unless the diff clearly contains unrelated units of work — then one commit per unit.
4. If a pre-commit hook fails: fix the cause if it's trivial and within the change (formatting, lint autofix), re-stage, and create a **new** commit. Otherwise stop and report the hook output. Never use `--no-verify`, never `--amend` a commit that's already pushed.

## 4. Push — only if there is something to push

- No upstream → `git push -u origin <branch>`.
- Upstream exists and `git rev-list --count @{u}..HEAD` > 0 → `git push`.
- **Never** push to the default branch. **Never** force-push. If the push is rejected (non-fast-forward), stop and report — don't pull, rebase or force on your own.

## 5. Report

Talk to the user in the language CLAUDE.md sets for this repo. Keep it to a few lines:

```
Branch: feature/savings-goal-progress (created from main)
Commit: feat(savings): show progress toward each goal
Push:   origin/feature/savings-goal-progress (new upstream)
```

Write "skipped — <reason>" for steps that didn't run, and add one line for anything excluded from the commit or flagged (invalid pushed branch name, local default branch left ahead of origin). Don't open a PR — that's `/grana-create-pr`.
