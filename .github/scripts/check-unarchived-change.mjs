#!/usr/bin/env node
/**
 * Fail when a pull request implements an OpenSpec change and leaves it
 * unarchived.
 *
 * Why this exists, and why it is preventive: this repository has not been bitten
 * by it. The sibling `pinpoint` repository was, twice. A change merged to `main`
 * with its implementation applied and the change folder never archived; the next
 * change merged on top of it; and by the time anybody looked, the master
 * specification stated the *opposite* of the code beside it — a colour scheme the
 * implementation had deleted two merges earlier. It took a third pull request to
 * repair, and every check in that repository was green throughout.
 *
 * AGENTS.md § "Archive happens in the branch, before merge to main" already
 * carries the rule, and it is stricter here than there: *"When a change
 * implementation is complete, archive it on the working branch before the merge
 * to `main`… Do not defer the archive to a follow-up PR."* Nothing enforces it.
 * `openspec:check` asks whether a specification is well *formed* and whether a
 * `Purpose` is still `TBD`; neither question notices that a change was applied
 * and never archived.
 *
 * WHAT IT ACTUALLY CHECKS, AND WHY NOT SOMETHING SIMPLER
 *
 * "Touches an unarchived change" is the obvious rule and it is wrong: opening a
 * proposal adds an unarchived change, which is the correct outcome of
 * `/opsx:propose` and must pass. The distinction that matters is whether the
 * pull request *implemented* anything:
 *
 *   touches an active change  +  touches nothing outside openspec/   -> a proposal, fine
 *   touches an active change  +  touches code                        -> an apply, must archive
 *   touches no active change                                         -> not our business
 *
 * So implementation is defined as **any path outside `openspec/`**. That is
 * deliberately blunt and deliberately fails closed. A narrower rule — excluding
 * documentation, say — would have to decide that `AGENTS.md` is not
 * implementation, and AGENTS.md is named by the archive rule itself as something
 * the branch must carry. Blunt costs the occasional false positive, which a
 * person clears in one line; narrow costs the thing this guard exists to catch,
 * which went unnoticed next door for two merges.
 *
 * THE MARKER SAYS "NOT FINISHED", NOT "LATER"
 *
 * The rule above binds *when the implementation is complete*. It does not forbid
 * applying a change across more than one pull request — it forbids finishing one
 * and putting the archive off. This script cannot tell a half-applied change from
 * a finished one, so there has to be a way to say which it is, and the wording
 * matters: a marker called "archive deferred" would license exactly what AGENTS.md
 * prohibits. It is a line in the pull request body:
 *
 *   Partial apply: <reason>
 *   Aplicación parcial: <razón>
 *
 * Either spelling is accepted — the bodies here are written in Spanish, and
 * anyone copying the marker out of `pinpoint` should not be tripped by the
 * language. The reason is required: a marker that permits an empty excuse is a
 * marker that gets pasted in without one.
 *
 * No dependencies on purpose: this runs before anything is installed.
 */
import { execFileSync } from 'node:child_process'

/** Where changes live while they are being worked on. */
const CHANGES = 'openspec/changes/'

/** Where they live afterwards, as `openspec/changes/archive/YYYY-MM-DD-<name>/`. */
const ARCHIVE = 'openspec/changes/archive/'

/**
 * The marker that declares an apply unfinished. Matched case-insensitively at
 * the start of a line, past whatever list or quote markup a person typed.
 */
const PARTIAL = /^[ \t>*-]*(?:partial apply|aplicaci[oó]n parcial):[ \t]*(\S.*)$/im

/**
 * Split a list of changed paths into the three things this check cares about.
 *
 * Paths are repository-relative and forward-slashed, which is what
 * `git diff --name-only` emits on every platform.
 *
 * @param {string[]} paths
 * @returns {{active: Set<string>, archived: Set<string>, implementation: string[]}}
 */
export function classify(paths) {
  const active = new Set()
  const archived = new Set()
  const implementation = []

  for (const path of paths) {
    if (path.startsWith(ARCHIVE)) {
      /* The date prefix is stripped so the archived folder can be matched
         against the active name it came from — they are never spelled alike. */
      const folder = path.slice(ARCHIVE.length).split('/')[0]
      if (folder) archived.add(folder.replace(/^\d{4}-\d{2}-\d{2}-/, ''))
      continue
    }

    if (path.startsWith(CHANGES)) {
      const folder = path.slice(CHANGES.length).split('/')[0]
      /* A file sitting directly in `openspec/changes/` belongs to no change. */
      if (folder && path.slice(CHANGES.length).includes('/')) active.add(folder)
      continue
    }

    /* Everything else. `openspec/specs/` is excluded along with the rest of
       `openspec/`, because syncing the specifications is *part of* archiving —
       counting it as implementation would make every archive look like one. */
    if (!path.startsWith('openspec/')) implementation.push(path)
  }

  return { active, archived, implementation }
}

/**
 * Decide whether a set of changed paths is a violation.
 *
 * @param {{paths: string[], body?: string}} input
 * @returns {{ok: boolean, unarchived: string[], implementation: string[], partial: string|null}}
 */
export function evaluate({ paths, body = '' }) {
  const { active, archived, implementation } = classify(paths)
  const unarchived = [...active].filter((name) => !archived.has(name)).sort()
  const partial = (body.match(PARTIAL)?.[1] ?? '').trim() || null

  const ok = unarchived.length === 0 || implementation.length === 0 || partial !== null

  return { ok, unarchived, implementation, partial }
}

/**
 * The files a pull request changes, as git sees them.
 *
 * Three dots, not two: it asks what the branch did, not what has happened on
 * the base since it forked. With two dots a busy `main` would drag unrelated
 * files into the answer and the guard would fire on work the branch never
 * touched.
 *
 * @param {string} base
 * @returns {string[]}
 */
export function changedPaths(base) {
  const committed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })

  /* Plus whatever is not committed yet. In CI the tree is clean and this adds
     nothing; locally it is the difference between `pnpm verify` warning you
     before you push and agreeing with you until it is somebody else's problem. */
  const working = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((path) => (path.includes(' -> ') ? path.slice(path.indexOf(' -> ') + 4) : path))
    .map((path) => path.replace(/^"|"$/g, ''))

  return [...new Set([...committed.split('\n').filter(Boolean), ...working])]
}

/**
 * Resolve something to compare against, tolerating the several shapes a base
 * arrives in: a bare branch name from `GITHUB_BASE_REF`, a full ref, or nothing
 * at all when this runs outside a pull request.
 *
 * @param {string|undefined} ref
 * @returns {string|null} a revision git can resolve, or null when there is
 *   nothing to compare — which is not a failure, it is a push to `main`.
 */
export function resolveBase(ref) {
  const candidates = ref
    ? [ref, `origin/${ref}`, `refs/remotes/origin/${ref}`]
    : ['origin/main', 'main']

  for (const candidate of candidates) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], {
        stdio: ['ignore', 'ignore', 'ignore'],
      })
      return candidate
    } catch {
      /* try the next shape */
    }
  }
  return null
}

function main() {
  const base = resolveBase(process.env.GITHUB_BASE_REF || process.env.BASE_REF)

  if (base === null) {
    console.log('check:unarchived — no base branch to compare against, nothing to check.')
    return
  }

  const paths = changedPaths(base)
  if (paths.length === 0) {
    console.log(`check:unarchived — no changes against ${base}, nothing to check.`)
    return
  }

  const { ok, unarchived, implementation, partial } = evaluate({
    paths,
    body: process.env.PR_BODY ?? '',
  })

  if (ok) {
    if (partial && unarchived.length > 0) {
      console.log(`check:unarchived — declared a partial apply: ${partial}`)
      return
    }
    console.log('check:unarchived OK')
    return
  }

  for (const name of unarchived) {
    console.error(
      `::error::openspec/changes/${name}/ is still active, and this pull request changes ` +
        `${implementation.length} file(s) outside openspec/. AGENTS.md: archive happens in ` +
        `the branch, before the merge to main. Run \`openspec archive ${name}\`.`,
    )
  }

  console.error(
    [
      '',
      'A change that reaches `main` unarchived leaves openspec/specs/ describing the',
      'code it just replaced. Next door in `pinpoint` that went unnoticed for two',
      'merges, and the specification ended up stating the opposite of the code.',
      '',
      'Files outside openspec/ that make this an apply rather than a proposal:',
      ...implementation.slice(0, 5).map((path) => `    ${path}`),
      implementation.length > 5 ? `    …and ${implementation.length - 5} more` : '',
      '',
      'If the implementation really is unfinished and continues in another pull',
      'request, say so on a line of its own in the body, with a reason:',
      '',
      '    Partial apply: <why>',
      '    Aplicación parcial: <por qué>',
      '',
      'That is for an apply that is not done. Finishing one and leaving the archive',
      'for a follow-up pull request is what AGENTS.md forbids outright.',
      '',
    ]
      .filter((line) => line !== '')
      .join('\n'),
  )
  process.exit(1)
}

/* Only when run directly, so the tests can import the pure functions above. */
if (process.argv[1] && process.argv[1].endsWith('check-unarchived-change.mjs')) main()
