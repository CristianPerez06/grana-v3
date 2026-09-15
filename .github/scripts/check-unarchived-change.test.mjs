#!/usr/bin/env node --test
/**
 * What the check has to get right, stated as path lists rather than as trees.
 *
 * The failing case is modelled on what actually happened in the sibling
 * `pinpoint` repository — a change applied across the packages and both apps
 * with its folder never archived — because this repository has no incident of
 * its own to assert against, and a guard written only against its author's
 * imagination catches only what its author imagined.
 *
 * The passing cases carry as much weight as the failing one. A guard that fires
 * on every proposal is a guard somebody turns off in a fortnight.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classify, evaluate } from './check-unarchived-change.mjs'

/** An apply: tasks ticked, packages and apps rewritten, nothing archived. */
const APPLY_WITHOUT_ARCHIVE = [
  'openspec/changes/edit-recurrence-due-day/tasks.md',
  'openspec/changes/edit-recurrence-due-day/design.md',
  'packages/recurrences/src/index.ts',
  'apps/web/app/transactions/recurring/page.tsx',
  'AGENTS.md',
]

/** The same work, archived on the branch as the rule requires. */
const ARCHIVE_PR = [
  'openspec/changes/edit-recurrence-due-day/tasks.md',
  'openspec/changes/archive/2026-09-14-edit-recurrence-due-day/tasks.md',
  'openspec/changes/archive/2026-09-14-edit-recurrence-due-day/proposal.md',
  'openspec/specs/recurrences/spec.md',
  'packages/recurrences/src/index.ts',
]

/** What `/opsx:propose` produces: a change and nothing else. */
const PROPOSAL = [
  'openspec/changes/guard-unarchived-changes/proposal.md',
  'openspec/changes/guard-unarchived-changes/tasks.md',
]

test('fails an apply that leaves the change unarchived', () => {
  const result = evaluate({ paths: APPLY_WITHOUT_ARCHIVE })

  assert.equal(result.ok, false)
  assert.deepEqual(result.unarchived, ['edit-recurrence-due-day'])
  assert.ok(result.implementation.includes('packages/recurrences/src/index.ts'))
})

test('counts AGENTS.md as implementation, because the archive rule names it', () => {
  const { implementation } = classify(APPLY_WITHOUT_ARCHIVE)

  assert.ok(implementation.includes('AGENTS.md'))
})

test('passes a pull request that archives the change it implemented', () => {
  // The date prefix is why this is not a string comparison: the folder under
  // archive/ is never spelled the same as the folder it came from.
  const result = evaluate({ paths: ARCHIVE_PR })

  assert.equal(result.ok, true)
  assert.deepEqual(result.unarchived, [])
})

test('passes a proposal, which is an unarchived change on purpose', () => {
  const result = evaluate({ paths: PROPOSAL })

  assert.equal(result.ok, true)
  assert.deepEqual(result.implementation, [])
})

test('passes a pull request that touches no change at all', () => {
  const result = evaluate({
    paths: ['apps/web/app/page.tsx', '.github/workflows/ci.yml', 'README.md'],
  })

  assert.equal(result.ok, true)
})

test('does not count syncing the master specs as implementation', () => {
  // Archiving writes openspec/specs/. If that counted, every archive would look
  // like an apply and the guard would fire on the one thing it wants.
  const { implementation } = classify([
    'openspec/specs/recurrences/spec.md',
    'openspec/changes/some-change/tasks.md',
  ])

  assert.deepEqual(implementation, [])
})

test('ignores a loose file sitting directly in openspec/changes/', () => {
  const { active } = classify(['openspec/changes/README.md'])

  assert.deepEqual([...active], [])
})

test('reports every unarchived change, not just the first', () => {
  const result = evaluate({
    paths: [
      'openspec/changes/one/tasks.md',
      'openspec/changes/two/tasks.md',
      'packages/money-logic/src/index.ts',
    ],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(result.unarchived, ['one', 'two'])
})

test('a change archived alongside another that is not still fails', () => {
  const result = evaluate({
    paths: [
      'openspec/changes/done/tasks.md',
      'openspec/changes/archive/2026-01-01-done/tasks.md',
      'openspec/changes/pending/tasks.md',
      'packages/money-logic/src/index.ts',
    ],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(result.unarchived, ['pending'])
})

test('a declared partial apply passes, in either language', () => {
  for (const line of [
    'Partial apply: the mobile half lands next',
    'Aplicación parcial: la mitad de mobile va después',
    'Aplicacion parcial: sin tilde, porque alguien la va a escribir así',
    '- Aplicación parcial: dentro de una lista',
  ]) {
    const result = evaluate({ paths: APPLY_WITHOUT_ARCHIVE, body: `texto\n${line}\n` })
    assert.equal(result.ok, true, line)
    assert.ok(result.partial, line)
  }
})

test('a marker with no reason does not count', () => {
  // A marker that accepts an empty excuse is one that gets pasted in without
  // thinking, which is the failure mode it exists to prevent.
  const result = evaluate({ paths: APPLY_WITHOUT_ARCHIVE, body: 'Partial apply:\n' })

  assert.equal(result.ok, false)
  assert.equal(result.partial, null)
})

test('the words in prose do not excuse anything', () => {
  const result = evaluate({
    paths: APPLY_WITHOUT_ARCHIVE,
    body: 'Esto no es una aplicación parcial de nada, es un apply completo.',
  })

  assert.equal(result.ok, false)
})

test('there is no way to spell "archive later"', () => {
  // pinpoint accepts `Archive deferred:`; this repository must not, because
  // AGENTS.md forbids deferring a finished change's archive outright.
  const result = evaluate({
    paths: APPLY_WITHOUT_ARCHIVE,
    body: 'Archive deferred: lo archivo en otro PR\n',
  })

  assert.equal(result.ok, false)
})
