import { describe, expect, it } from 'vitest'
import type {
  EnrichedRecurrenceInstance,
  PendingRecurrenceInstance,
  RecurrenceDetail,
} from '@/lib/recurrences/types'

/**
 * A COMPILE-TIME regression: which instances may have an unknown vencimiento.
 *
 * `PendingRecurrenceInstance` promises `due_date: string`, and that promise only
 * holds for an occurrence still awaiting a decision. It was briefly the type of
 * `RecurrenceDetail.instances` — the rule's whole history, `confirmed` rows
 * included — where an occurrence resolved before 0064 carries `NULL` +
 * `due_date_is_unknown`. The compiler was being told those nulls could not
 * happen, in the one list that is full of them.
 *
 * The assertions below are checked by `pnpm --filter web typecheck`, not at
 * runtime: vitest strips types without checking them. Re-narrowing the history
 * breaks the first one; widening the pending type deletes the error the
 * `@ts-expect-error` is waiting for and breaks the second.
 */

const base = {} as EnrichedRecurrenceInstance

// The history holds occurrences whose vencimiento is unrecoverable.
const historical: RecurrenceDetail['instances'][number] = { ...base, due_date: null }

// The review feed does not.
// @ts-expect-error a `pending` occurrence always has an exact vencimiento
const unresolved: PendingRecurrenceInstance = { ...base, due_date: null }

describe('instance types', () => {
  it('separates the enriched instance from the exact-vencimiento subtype', () => {
    expect(historical.due_date).toBeNull()
    expect(unresolved.due_date).toBeNull()
  })
})
