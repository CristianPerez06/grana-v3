import { describe, expect, it } from 'vitest'
import type {
  EnrichedRecurrenceInstance,
  PendingRecurrenceInstance,
  RecurrenceDetail,
  RecurrenceInstance,
  RecurrenceSummary,
} from '@/lib/recurrences/types'

/**
 * A COMPILE-TIME regression: what the pending subtype is allowed to promise.
 *
 * The pending types promise TWO things — `status: 'pending'` and a non-null
 * `due_date` — and they only hold together. `due_date: string` alone is a claim
 * about resolved rows too, which is false: an occurrence confirmed before 0064
 * carries `NULL` + `due_date_is_unknown`. The narrow type was briefly used for
 * `RecurrenceDetail.instances` — the rule's whole history — so the compiler was
 * being told those nulls could not happen in the one list that is full of them.
 *
 * The assertions below are checked by `pnpm --filter web typecheck`, not at
 * runtime: vitest strips types without checking them. Re-narrowing the history
 * breaks the first one; dropping either half of the narrowing deletes the error
 * one of the `@ts-expect-error`s is waiting for.
 */

const base = {} as EnrichedRecurrenceInstance
const core = {} as RecurrenceInstance

// The history holds occurrences whose vencimiento is unrecoverable.
const historical: RecurrenceDetail['instances'][number] = { ...base, due_date: null }

// The review feed does not.
// @ts-expect-error an unresolved occurrence always has an exact vencimiento
const noDueDate: PendingRecurrenceInstance = { ...base, due_date: null, status: 'pending' }

// And it holds nothing already resolved: a `confirmed` row is not a feed row,
// whatever its `due_date` says.
const resolved: PendingRecurrenceInstance = {
  ...base,
  due_date: '2026-06-23',
  // @ts-expect-error a resolved occurrence is not pending
  status: 'confirmed',
}

// The un-enriched half of the pair carries the same two promises, because
// `RecurrenceSummary.pending_instances` is built from it.
const summaryRow: RecurrenceSummary['pending_instances'][number] = {
  ...core,
  due_date: '2026-06-23',
  // @ts-expect-error a resolved occurrence is not pending
  status: 'skipped',
}

describe('instance types', () => {
  it('separates the enriched instance from the unresolved-occurrence subtype', () => {
    expect(historical.due_date).toBeNull()
    expect(noDueDate.due_date).toBeNull()
    expect(resolved.status).toBe('confirmed')
    expect(summaryRow.status).toBe('skipped')
  })
})
