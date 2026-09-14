#!/usr/bin/env node
/**
 * Fail if the OpenSpec-generated agent instructions are not exactly the five
 * workflows this repository keeps.
 *
 * Why this exists: which workflows OpenSpec generates is a machine-level
 * setting, not a repository one. It lives in the global config, its default
 * `core` profile includes `explore`, and `openspec update` rewrites every
 * generated file from whatever that machine happens to say. So the decision to
 * drop the generated `explore` — its text is kept word for word as a skill this
 * repository owns, `/grana-deep-explore`, so it runs only when typed by name
 * and no update rewrites it; the everyday `/grana-lightweight-explore` follows
 * AGENTS.md § Talking to the user — cannot be recorded in the repository by
 * deleting the file. It is undone by the next update, on any machine, with
 * nothing in the diff that looks wrong.
 *
 * The rule is stated as the whole set rather than as a ban on `explore`: the
 * generated workflows must be these five, no more and no fewer. A ban would be
 * blind to a sixth workflow nobody asked for; the set is not.
 *
 * It reads the working tree, not the index, so it fails the moment the files
 * appear — before they are staged, and whether or not they are ignored.
 *
 * No dependencies on purpose: this must run before anything is installed.
 */
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The instructions this repository uses in place of the generated `explore`.
 * Named in the failure message so the person reading it knows what they lose by
 * deleting the file (nothing) and what to use instead.
 */
const REPLACEMENT = '/grana-lightweight-explore, or /grana-deep-explore for the same text word for word,'

/** The workflows this repository keeps, in the order OpenSpec lists them. */
export const WORKFLOWS = ['propose', 'apply', 'update', 'sync', 'archive']

/**
 * One workflow, two names. The slash command is named after the workflow; the
 * skill directory is named after what the workflow does, so the mapping has to
 * be written out rather than derived.
 */
const SKILL_OF_WORKFLOW = {
  propose: 'openspec-propose',
  apply: 'openspec-apply-change',
  update: 'openspec-update-change',
  sync: 'openspec-sync-specs',
  archive: 'openspec-archive-change',
}

const WORKFLOW_OF_SKILL = new Map(
  Object.entries(SKILL_OF_WORKFLOW).map(([workflow, skill]) => [skill, workflow]),
)

/**
 * `openspec-explore` is not in the map, and neither is whatever a later release
 * adds — which is the whole point. Falling back to the first segment of the name
 * gives an unwanted workflow something to be called in the error message.
 */
function workflowOfSkill(name) {
  return WORKFLOW_OF_SKILL.get(name) ?? name.slice('openspec-'.length).split('-')[0]
}

/**
 * Every directory OpenSpec writes into, and what belongs there. `keeps: []`
 * means the location is retired: nothing generated belongs there at all.
 */
export const SURFACES = [
  {
    dir: '.claude/commands/opsx',
    read: 'Claude Code reads these as the /opsx:* commands',
    entry: 'file',
    isGenerated: (name) => name.endsWith('.md'),
    workflowOf: (name) => name.slice(0, -'.md'.length),
    nameOf: (workflow) => `${workflow}.md`,
    keeps: WORKFLOWS,
  },
  {
    dir: '.agents/skills',
    read: 'Codex reads these as skills',
    entry: 'directory',
    isGenerated: (name) => name.startsWith('openspec-'),
    workflowOf: workflowOfSkill,
    nameOf: (workflow) => SKILL_OF_WORKFLOW[workflow],
    keeps: WORKFLOWS,
  },
  {
    dir: '.claude/skills',
    read: 'a location OpenSpec used to write and no longer does — the workflows reach Claude Code through .claude/commands/opsx/ now',
    entry: 'directory',
    isGenerated: (name) => name.startsWith('openspec-'),
    workflowOf: workflowOfSkill,
    nameOf: (workflow) => SKILL_OF_WORKFLOW[workflow],
    keeps: [],
  },
]

/**
 * @param {string} root repository root
 * @returns {{surfaces: {dir: string, present: boolean, found: string[]}[],
 *            problems: {kind: 'unwanted'|'missing', path: string, workflow: string, surface: object}[]}}
 */
export function inspect(root) {
  const surfaces = []
  const problems = []

  for (const surface of SURFACES) {
    const dir = join(root, surface.dir)
    if (!existsSync(dir)) {
      surfaces.push({ dir: surface.dir, present: false, found: [] })
      continue
    }

    const found = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => (surface.entry === 'file' ? entry.isFile() : entry.isDirectory()))
      .map((entry) => entry.name)
      .filter((name) => surface.isGenerated(name))
      .sort()

    surfaces.push({ dir: surface.dir, present: true, found })

    for (const name of found) {
      const workflow = surface.workflowOf(name)
      if (!surface.keeps.includes(workflow)) {
        problems.push({ kind: 'unwanted', path: `${surface.dir}/${name}`, workflow, surface })
      }
    }

    // An empty surface is a surface this checkout does not materialise — the
    // directory may be ignored, or the tool that writes it may never have run
    // here. Only a surface that already holds generated workflows is held to
    // holding all of them; otherwise CI would fail on a clone for the absence
    // of files it is not supposed to have.
    if (found.length === 0) continue

    const present = new Set(found.map((name) => surface.workflowOf(name)))
    for (const workflow of surface.keeps) {
      if (!present.has(workflow)) {
        problems.push({
          kind: 'missing',
          path: `${surface.dir}/${surface.nameOf(workflow)}`,
          workflow,
          surface,
        })
      }
    }
  }

  return { surfaces, problems }
}

const PROFILE_FIX = [
  '  openspec config set profile custom',
  `  openspec config set workflows '${JSON.stringify(WORKFLOWS)}'`,
].join('\n')

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const { surfaces, problems } = inspect(root)

  for (const surface of surfaces) {
    const summary = surface.present
      ? surface.found.join(', ') || '(none)'
      : '(directory not present)'
    console.log(`  ${surface.dir.padEnd(24)} -> ${summary}`)
  }

  if (problems.length === 0) {
    console.log(`\nThe generated OpenSpec workflows are the expected ${WORKFLOWS.length}.`)
    return
  }

  console.error('')
  for (const problem of problems) {
    if (problem.kind === 'unwanted') {
      console.error(
        `::error::${problem.path} is a generated OpenSpec workflow this repository does not keep. ` +
          `It is written by \`openspec update\`, and removing it was deliberate: ${REPLACEMENT} replace it. ` +
          `Delete it — then stop the next update from writing it again.`,
      )
    } else {
      console.error(
        `::error::${problem.path} is missing: the '${problem.workflow}' workflow is one of the ` +
          `${WORKFLOWS.length} this repository keeps, and the other generated workflows are there. ` +
          `Restore the workflow list and re-run \`openspec update\`.`,
      )
    }
  }

  console.error(
    `\nThe workflow list is a global, per-machine OpenSpec setting, so a fresh clone\n` +
      `regenerates whatever this machine says. Fix the machine, not just the files:\n\n` +
      `${PROFILE_FIX}\n\n` +
      `Locations checked (and what reads them):\n` +
      SURFACES.map((surface) => `  ${surface.dir} — ${surface.read}`).join('\n') +
      `\n\nIf you are here to delete this check, read AGENTS.md § Talking to the user first.\n`,
  )
  process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
