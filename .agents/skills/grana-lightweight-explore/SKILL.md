---
name: grana-lightweight-explore
description: Think through an idea, a problem, or a GitHub issue for Grana before any change exists — grounded in the specs and talked about the way AGENTS.md asks. Thinking only; it writes nothing.
---

# Explore

Think alongside the user about something in Grana: an idea, a problem, a GitHub issue,
or a change already in flight.

Use this instead of OpenSpec's own explore instructions, which ask for diagrams,
multiple approaches and length this repo does not want.

**It writes nothing** — no code, no files, no OpenSpec artifacts. When the thinking is
done and the user wants it captured, say so and stop. Capturing is the
`openspec-propose` skill, which they start.

## How to talk

**Always in Spanish** — `AGENTS.md` § Language conventions.

`AGENTS.md` § Talking to the user governs this conversation, and wins over anything
else loaded in the turn. The whole of it applies; these are the ones that get lost:

- **Explain for someone who doesn't write code.** Say what the person using the app
  will see or be able to do, not what happens in the code.
- **Ask before going deep on technical detail.** One line: *"Dónde se calculan los
  saldos merece una discusión técnica. ¿Te muestro las opciones o decido yo?"*
- **Recommend, don't survey.** One recommendation. Alternatives only when asked, or
  when the choice is genuinely the user's.
- **Keep it short.** One question at a time, recommendation first.

No ASCII diagrams, no comparison tables, no lists of threads to pull, unless asked.

## Ground it before saying anything

Never ask what you could have looked up.

1. If a GitHub issue is named, read it with `gh issue view`.
2. `openspec list --json` — what is already in flight. Before proposing anything new,
   check that no active change touches the same capability (`AGENTS.md` § Pre-change
   check); if one does, ordering is part of what has to be decided.
3. `openspec list --specs` — then read every relevant one **in full**, scenarios
   included: `openspec show "<id>" --type spec`. The rules in force live there, and a
   question is usually already half-answered by them.
4. Read the code the question is actually about.
5. `AGENTS.md` § Domain, § Cross-cutting principles and § Modules for the standing
   rules a feature cannot contradict, and `docs/` for what has already been explored.

Read files and run the commands above; do not edit anything while exploring.

## What to say back

- Name the decision that is actually the user's, and give one recommendation with the
  reason in a sentence.
- Where the specs already settle something, say so and don't reopen it.
- A defect noticed along the way: mention it only if it bears on the decision in hand.
  Otherwise hold it — findings belong in the change's `findings.md`, later.
- When it is time to capture: name which capability's spec it touches, and stop. The
  archive runs on the branch before the merge, and `pnpm openspec:check` has to pass.
