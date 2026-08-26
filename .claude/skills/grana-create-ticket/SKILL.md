---
name: grana-create-ticket
description: Turn a rough description of something to build or fix into a well-formed GitHub issue on the Grana board, following the repo's issue templates. Writes the trigger for a later deep dive, not the deep dive.
user_invocable: true
allowed-tools: Bash
---

# Create ticket

Turn what the user describes — usually a couple of sentences, often noticed mid-task — into a GitHub issue on `CristianPerez06/grana-v3`, written against the repo's issue template and filed on the **Grana** project board (user project `#1`).

**This skill writes the trigger, not the investigation.** The ticket exists so that the deep dive can happen *later*, with an issue already open and the context recovered. Do not read the implementation to establish root causes, trace call graphs, or design the fix — see [Grounding budget](#grounding-budget) for exactly where the line is. A ticket that honestly says "hay que confirmar X" is doing its job; a ticket that asserts a cause nobody verified is worse than no ticket.

**Ticket title and body are written in Spanish** — the issue templates are in Spanish and project documentation is in Spanish (AGENTS.md, "Language conventions"). Only the bracketed prefix (`[Bug]:`, `[Feature]:`, `[Improvement]:`) stays as the template defines it.

## Preconditions

Stop and explain instead of guessing if any of these fails:

- `gh` CLI is installed and authenticated, with the `project` scope (writing to Projects v2 needs it).
- The user gave enough context to say *what* is wrong or missing. If they didn't, ask — don't invent one.

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
   > After authenticating, verify with `gh auth status` and re-run `/grana-create-ticket`.

   Do not attempt to install `gh` yourself — let the user do it (auth is browser-interactive and varies per platform).

   Also confirm the token can write to the board:

   ```bash
   gh auth status 2>&1 | grep -i 'token scopes'
   ```

   If `project` is missing from the scopes, the issue will still be created but `--project` will fail. Tell the user to run `gh auth refresh -s project` — don't discover this after the issue exists.

2. **Gather context — ask, don't guess.**

   If the skill was invoked with an argument (`/grana-create-ticket la búsqueda de movimientos no encuentra por descripción`), or the user already described the thing earlier in the conversation, **treat that as the answer and skip ahead**. Do not make someone repeat themselves to satisfy a form.

   Otherwise ask, in **one** message, in whatever language the user is speaking:

   - **Qué pasa / qué falta** — in their own words, one or two sentences.
   - **Dónde** — route, screen, package, app (`web` / `mobile`), or a file if they have it. *"No sé"* is a fine answer.
   - **Por qué importa** — what should happen instead, or what it costs today.
   - **Algo que ya sepas** — a related issue, a spec, something already tried, a screenshot.

   Rules for this step:

   - A free-text dump is the expected input. Parse it; don't force a Q&A round-trip.
   - Ask **once**. Re-ask only for something whose absence would change the ticket materially (e.g. it is genuinely unclear whether the current behaviour is wrong or merely unloved). Everything else becomes an open question *inside* the ticket, which is where it belongs.
   - Never fill a gap by inventing detail. An invented repro step is a lie the future deep dive has to disprove.

3. **Classify the ticket**, per the table in [Type → template, title, label](#type--template-title-label). Infer it from what the user said; if it is genuinely ambiguous (a "this should work differently" that could be a bug or an improvement), pick the one that fits best, say which you picked and why in the confirmation, and let the user flip it.

4. **Check for duplicates** before drafting:

   ```bash
   gh issue list --repo CristianPerez06/grana-v3 --state open --limit 100 --json number,title,labels
   ```

   Scan titles for the same subject. If something looks like a match, surface it (`#NN — title`) and ask whether to add a comment there instead of opening a new ticket. Two tickets for one problem is how a board stops being trustworthy.

5. **Read the issue template from disk** — it is the source of truth and it changes:

   ```bash
   cat .github/ISSUE_TEMPLATE/<bugfix|feature|improvement>.md
   ```

   Draft the body section by section, keeping the template's headings, in its order. See [Writing the body](#writing-the-body).

6. **Show the user the draft and confirm**:
   - Print the type you picked (and why, if it was a close call).
   - Print the proposed title.
   - Print the proposed body.
   - Print the label and the board destination (`Grana` → `Backlog`).
   - Ask: "¿Creo este ticket?" — accept y/n or "edit" (in which case ask what to change and regenerate).

   Never create the issue without this confirmation. An issue is public and outward-facing; a bad one has to be edited or closed by hand.

7. **Verify the label exists before passing it.** `gh issue create` fails outright on an unknown label, and a renamed or deleted label would otherwise lose the whole ticket:

   ```bash
   gh label list --repo CristianPerez06/grana-v3 --json name --jq '.[].name'
   ```

   Use only labels that come back. If the one from the table is missing, create the issue without it and say so in your report — a missing label is not a reason to lose the ticket.

8. **On confirmation, create the issue**:

   ```bash
   gh issue create \
     --repo CristianPerez06/grana-v3 \
     --title "<title>" \
     --label "<label>" \
     --project "Grana" \
     --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   Use a HEREDOC with a quoted delimiter for the body — it preserves formatting and stops the shell from eating backticks, `$`, and quotes in the ticket text.

9. **Verify it landed on the board in `Backlog`.** The project has an "item added" automation, but it is not something to take on faith:

   ```bash
   ISSUE=<number>
   gh project item-list 1 --owner CristianPerez06 --limit 200 --format json \
     --jq ".items[] | select(.content.number==$ISSUE) | {id, status}"
   ```

   If `status` is empty or absent, set it explicitly:

   ```bash
   PROJECT_ID=$(gh project view 1 --owner CristianPerez06 --format json --jq '.id')
   FIELD_ID=$(gh project field-list 1 --owner CristianPerez06 --format json --jq '.fields[] | select(.name=="Status") | .id')
   OPTION_ID=$(gh project field-list 1 --owner CristianPerez06 --format json --jq '.fields[] | select(.name=="Status") | .options[] | select(.name=="Backlog") | .id')
   ITEM_ID=$(gh project item-list 1 --owner CristianPerez06 --limit 200 --format json --jq ".items[] | select(.content.number==$ISSUE) | .id")
   gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID"
   ```

   Leave `Priority` and `Size` empty. Those are the user's call at triage, not something to guess from a two-sentence description.

10. **Report the issue URL and number** back as the final output, plus:
    - anything you could not verify and left as an open question in the ticket,
    - any label that was dropped,
    - the branch name this ticket implies, if the user is likely to start on it now: `<prefix>/<issue-number>-<kebab-case>` (AGENTS.md "Branching"). `/grana-create-pr` reads that number to fill the PR's `🔗 Ticket` section, which is what moves the ticket to Done on merge.

## Type → template, title, label

| The user is describing | Template | Title prefix | Label |
| --- | --- | --- | --- |
| Something that is broken, or behaves against its own spec | `bugfix.md` | `[Bug]: ` | `bug` |
| Something that does not exist yet | `feature.md` | `[Feature]: ` | `feature` |
| Something that works but should work better — refactor, perf, DX, parity, polish | `improvement.md` | `[Improvement]: ` | `improvement` |

**On the labels**: each label above matches the template's own front matter — they agree, and both are correct. Note that issues opened before 2026-08-26 carry `enhancement` instead, because `feature` and `improvement` did not exist in this repo yet. That is history, not convention: do not copy it into new tickets, and do not read an old `enhancement` issue as evidence of what to use.

**Title rules** — the prefix is followed by Spanish:

- Say what should be true, or what is wrong. Not the area it lives in.
- Specific enough to be recognised in a list six weeks later: `[Bug]: El filtro de fechas custom no aplica al feed` beats `[Bug]: Problema con filtros`.
- No trailing period. Aim under ~90 characters.

## Writing the body

Fill every heading the template defines, in its order. **Every section carries the same rule: write what is known, mark what is not.**

### Sections that describe what the user observed

`### 🧩 Resumen`, `### 🎯 Objetivo`, `### 🧱 Contexto` / `### 🧠 Contexto`.

These you can write with confidence — they are a faithful restatement of what the user told you, tightened. Lead with the symptom or the outcome, not the mechanism. Include the *why it matters* the user gave you; a ticket whose motivation is missing gets deprioritised forever because nobody can reconstruct the cost.

### Sections that would need the deep dive

`### 💥 Causa raíz`, `### 🔧 Plan de arreglo`, `### 🧩 Plan de implementación`, `### 🔧 Enfoque`.

This is where trigger-tickets go wrong. You have not read the code, so:

- Write the best **hypothesis**, and label it one: *"Hipótesis, sin verificar: …"* or *"A confirmar: …"*.
- Better than a hypothesis is **the question to answer first**: *"Primero hay que ver si el filtro llega al query o se pierde en el contexto."* That is the deep dive's actual starting point, and it is honest.
- If the user gave you a concrete direction ("creo que es el `useQuery` de movimientos"), record it **as theirs**, not as a finding.
- If you have nothing, write `Por definir — requiere revisar el código.` A blank section reads as an oversight; that line reads as a decision.

Never present a guess in the voice of a conclusion. The ticket is read later by someone who will trust it.

### Verification sections

`### 🧪 Pasos de verificación`, `### ✅ Criterios de aceptación`, `### 🧪 Validación`.

These you *can* write well without reading code, and they are the most valuable part of a trigger ticket — they define done. Write them from the user's description as observable behaviour: what to open, what to do, what should happen. For a bug, the repro steps if the user gave them; if they didn't, say so plainly (`Repro por confirmar`) rather than inventing a path.

### Checklists

Leave every box **unticked**. Nothing has happened yet. Drop a line that cannot apply (a spec item on a ticket that touches no spec) rather than leaving it to be ticked out of habit.

### `### 🔗 Relacionado`

Link what you actually found in the duplicate scan or what the user named — issues (`#NN`), specs under `openspec/specs/`, files with paths. Delete the section if there is genuinely nothing; an empty "Relacionado" is noise.

## Grounding budget

A little grounding makes the ticket findable later. A lot of it is the deep dive this ticket exists to schedule.

**Allowed** — a handful of cheap lookups, no more:

- `ls` or `git ls-files` on a path the user named, to get the real file path into the ticket instead of an approximation.
- `grep -rn` for a string the user quoted (an on-screen label, a function name), to point the ticket at the right place.
- `gh issue list` for duplicates and for `#NN` references.
- `cat` on the issue template and, if relevant, a spec file the user named.

**Not allowed:**

- Reading the implementation to determine the cause.
- Following the call graph, or opening files nobody named to "see how it works".
- Running the app, the test suite, `pnpm build`, `pnpm typecheck` — this skill runs no validations.
- Writing a diff, or describing the fix at line level.

**The stopping rule**: if a question can't be answered inside that budget, it does not get answered — it goes into the ticket as an open question. That is not a shortfall of the ticket, it is the ticket's content.

## Conventions

- `.github/ISSUE_TEMPLATE/*.md` is the source of truth for body structure. Read it from disk each time; if it changes, follow it.
- Ticket title and body in Spanish; the bracketed prefix and the template's own headings stay as written. See AGENTS.md "Language conventions".
- One ticket, one thing. If the user describes two problems in one breath, say so and offer to file two — a ticket with two subjects gets half-closed.
- The board is `Grana`, user project `#1`, owner `CristianPerez06`. New tickets land in `Backlog`.
- This skill does not create branches, does not commit, and does not start the work. It opens the issue and stops.

## Edge cases

- **`gh` not installed / not authenticated**: handled by Step 1 with the cross-platform install message.
- **Token missing the `project` scope**: `gh auth refresh -s project`. Catch it in Step 1, not after the issue exists.
- **The issue was created but `--project` failed**: the issue is real and must not be recreated. Add it to the board by hand with `gh project item-add 1 --owner CristianPerez06 --url <issue-url>`, then set `Backlog` per Step 9.
- **A duplicate exists**: offer to comment on the open issue instead. Only open a second ticket if the user says the two are genuinely different.
- **The description is too vague to file** ("hay algo raro en el dashboard"): ask once, concretely, for what they saw and where. If it is still too thin, say plainly that there isn't a ticket here yet and offer to write it once they can name the symptom — an unfileable ticket clogs the board and nobody can close it.
- **It's a question, not a ticket**: if what the user described is uncertainty rather than work ("¿esto debería funcionar así?"), the right ticket is often an `[Improvement]` framed as a decision to make, with the options listed and no answer picked. Say the framing you chose in the confirmation.
- **The user wants it filed on a different board or repo**: this skill is hardcoded to `grana-v3` / project `Grana`. Send them to `/pinpoint-create-ticket` for Pinpoint rather than parameterising this one.
