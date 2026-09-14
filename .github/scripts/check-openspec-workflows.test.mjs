#!/usr/bin/env node --test
/**
 * What the check has to get right, on trees built here rather than on this one.
 *
 * The repository's own tree only ever exercises the passing case, so a check
 * that silently found nothing — a wrong directory name, a filter that matches
 * nothing — would look identical to a check that works. Every case below builds
 * the tree it asserts on.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { inspect, WORKFLOWS } from './check-openspec-workflows.mjs'

const SKILLS = [
  'openspec-propose',
  'openspec-apply-change',
  'openspec-update-change',
  'openspec-sync-specs',
  'openspec-archive-change',
]

/**
 * @param {{commands?: string[], agentSkills?: string[], claudeSkills?: string[]}} tree
 * @returns {string} a repository root to inspect
 */
function build(tree) {
  const root = mkdtempSync(join(tmpdir(), 'openspec-workflows-'))

  if (tree.commands) {
    const dir = join(root, '.claude/commands/opsx')
    mkdirSync(dir, { recursive: true })
    for (const name of tree.commands) writeFileSync(join(dir, `${name}.md`), '# generated\n')
  }
  for (const [key, path] of [
    ['agentSkills', '.agents/skills'],
    ['claudeSkills', '.claude/skills'],
  ]) {
    if (!tree[key]) continue
    for (const name of tree[key]) {
      mkdirSync(join(root, path, name), { recursive: true })
      writeFileSync(join(root, path, name, 'SKILL.md'), '# generated\n')
    }
  }

  return root
}

/** @param {Parameters<typeof build>[0]} tree */
function problemsOf(tree) {
  const root = build(tree)
  try {
    return inspect(root).problems
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('the five workflows in both live locations pass', () => {
  assert.deepEqual(problemsOf({ commands: WORKFLOWS, agentSkills: SKILLS }), [])
})

test('a repository with none of the directories passes', () => {
  assert.deepEqual(problemsOf({}), [])
})

test('a surface with nothing generated in it is not held to holding all five', () => {
  // The case that matters in CI: pinpoint ignores `.agents/`, so the checkout
  // has the directory with only the repository's own skill in it.
  assert.deepEqual(problemsOf({ commands: WORKFLOWS, agentSkills: [] }), [])
})

test('explore coming back as a command fails, naming the file', () => {
  const problems = problemsOf({ commands: [...WORKFLOWS, 'explore'], agentSkills: SKILLS })
  assert.deepEqual(
    problems.map((p) => [p.kind, p.path]),
    [['unwanted', '.claude/commands/opsx/explore.md']],
  )
})

test('explore coming back as a Codex skill fails, naming the directory', () => {
  const problems = problemsOf({
    commands: WORKFLOWS,
    agentSkills: [...SKILLS, 'openspec-explore'],
  })
  assert.deepEqual(
    problems.map((p) => [p.kind, p.path, p.workflow]),
    [['unwanted', '.agents/skills/openspec-explore', 'explore']],
  )
})

test('`openspec update` on the default profile fails in both locations at once', () => {
  const problems = problemsOf({
    commands: [...WORKFLOWS, 'explore'],
    agentSkills: [...SKILLS, 'openspec-explore'],
  })
  assert.deepEqual(problems.map((p) => p.path).sort(), [
    '.agents/skills/openspec-explore',
    '.claude/commands/opsx/explore.md',
  ])
})

test('a workflow nobody asked for fails even though it is not explore', () => {
  // The reason the rule is the whole set and not a ban on one name.
  const problems = problemsOf({ commands: [...WORKFLOWS, 'refactor'], agentSkills: SKILLS })
  assert.deepEqual(
    problems.map((p) => [p.kind, p.workflow]),
    [['unwanted', 'refactor']],
  )
})

test('the retired skills location rejects the five workflows too', () => {
  // pinpoint deleted all six of these; none of them belongs there any more,
  // not even the five that are kept elsewhere.
  const problems = problemsOf({ commands: WORKFLOWS, claudeSkills: SKILLS })
  assert.equal(problems.length, SKILLS.length)
  assert.ok(problems.every((p) => p.kind === 'unwanted'))
  assert.ok(problems.every((p) => p.path.startsWith('.claude/skills/openspec-')))
})

test("the repository's own skills are none of the check's business", () => {
  const ownSkills = [
    'grana-lightweight-explore',
    'grana-deep-explore',
    'pinpoint-lightweight-explore',
    'pinpoint-deep-explore',
  ]
  const problems = problemsOf({
    commands: WORKFLOWS,
    agentSkills: [...SKILLS, ...ownSkills],
    claudeSkills: [...ownSkills, 'impeccable'],
  })
  assert.deepEqual(problems, [])
})

test('a short workflow list is reported as missing, per surface', () => {
  const problems = problemsOf({
    commands: ['propose', 'apply'],
    agentSkills: SKILLS,
  })
  assert.deepEqual(
    problems.map((p) => [p.kind, p.path]),
    [
      ['missing', '.claude/commands/opsx/update.md'],
      ['missing', '.claude/commands/opsx/sync.md'],
      ['missing', '.claude/commands/opsx/archive.md'],
    ],
  )
})
