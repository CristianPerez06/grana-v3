---
name: create-pr
description: Create a GitHub pull request for the current branch, with title and body auto-drafted from the commits ahead of main, following the repo's PR template.
user_invocable: true
allowed-tools: Bash
---

# Create PR

Open a GitHub pull request for the current branch. The PR title and body are drafted from the commits unique to the branch and structured to match `.github/PULL_REQUEST_TEMPLATE.md` (Summary / New features / Chores).

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
   > After authenticating, verify with `gh auth status` and re-run `/create-pr`.

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
   - Ask the user whether to commit them first (offer to invoke the `suggest-branch-and-commit` skill), stash them, or proceed without them.
   - Do not silently include uncommitted work in the PR.

4. **Ensure the branch is pushed**: if `git status -sb` shows the branch isn't tracking a remote, or shows commits ahead of origin, run `git push -u origin <current-branch>`.

5. **Synthesize the title**:
   - If exactly one commit on the branch: use its subject line verbatim (it should already follow conventional commit format).
   - If multiple commits: construct a single conventional-commit-style title that captures the dominant theme. Lean on the most substantive commit. Keep under 70 chars. Lowercase after the colon.
   - Strip trailing periods.

6. **Synthesize the body** matching the structure of `.github/PULL_REQUEST_TEMPLATE.md`:

   - **Summary** (always): 1-2 sentences on what the PR does and why. Read the diff, not just the commit messages — focus on intent, not a file recap. Don't reference "this PR" verbosely; write it as a description of the change.

   - **New features**: bullet list of commits typed `feat(...)`. One bullet per commit using its subject minus the conventional prefix. Omit this section entirely if there are no `feat` commits.

   - **Chores**: bullet list of everything else (`chore`, `ci`, `docs`, `fix`, `refactor`, `test`, `perf`, `style`, `build`). One bullet per commit. Omit if empty.

   Keep bullets concise. If a commit message has a body that adds important detail, mention the key point inline; don't paste full commit bodies.

7. **Show the user the draft and confirm**:
   - Print the proposed title.
   - Print the proposed body.
   - Ask: "Create this PR?" — accept y/n or "edit" (in which case ask what to change and regenerate).

8. **On confirmation, create the PR**:

   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   Use a HEREDOC for the body to preserve formatting and avoid quote-escaping problems.

9. **Report the PR URL** back to the user as the final output.

## Conventions

- The repo's PR template (`.github/PULL_REQUEST_TEMPLATE.md`) is the source of truth for body structure. If it changes, follow it.
- Conventional commit type → body section mapping:
  - `feat` → **New features**
  - `chore`, `ci`, `docs`, `fix`, `refactor`, `test`, `perf`, `style`, `build` → **Chores**
- Bugfixes go under **Chores** by design — they restore correct behavior, they don't add new functionality.
- Empty sections are omitted from the body. Don't leave "New features\n\n- " stubs.
- If the branch is messy (many WIP commits, unclear messages), suggest the user squash + rewrite via `git rebase -i main` before creating the PR. A clean branch makes the body draft itself.

## Edge cases

- **`gh` not installed / not authenticated**: handled by Step 1 with the cross-platform install message.
- **No commits ahead of main**: stop. Tell the user the branch has nothing to PR.
- **Existing PR for this branch**: surface its URL instead of creating a duplicate.
- **Repo has CI with required checks**: mention to the user that the PR will run CI on creation; they should wait for green before merging.
- **Repo has branch protection requiring linear history**: mention that the merge will need to be squash or rebase, not a merge commit.
