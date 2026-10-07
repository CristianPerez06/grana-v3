import { describe, expect, it } from 'vitest'
import { countPendingSharedRecurrenceInstances } from '../src/queries'

/**
 * The Compartido teaser counts shared occurrences still to confirm. An unresolved
 * occurrence dated after today — the one unlinking leaves behind — is not
 * something that should already have happened, so it must not count.
 *
 * A recording double, because the read is a single filtered count: what matters
 * is which filters reach PostgREST, and the pglite harness does not speak
 * `head: true`.
 */
function recordingClient(count: number) {
  const calls: Array<[string, ...unknown[]]> = []
  const query = {
    select: (...args: unknown[]) => (calls.push(['select', ...args]), query),
    eq: (...args: unknown[]) => (calls.push(['eq', ...args]), query),
    not: (...args: unknown[]) => (calls.push(['not', ...args]), query),
    lte: (...args: unknown[]) => (calls.push(['lte', ...args]), query),
    then: (resolve: (value: { count: number }) => unknown) => resolve({ count }),
  }
  const client = {
    from: (table: string) => (calls.push(['from', table]), query),
  }
  return { client: client as never, calls }
}

describe('countPendingSharedRecurrenceInstances', () => {
  it('counts only shared pendings whose vencimiento has already arrived', async () => {
    const { client, calls } = recordingClient(1)

    const result = await countPendingSharedRecurrenceInstances(client, '2026-10-07')

    expect(result).toBe(1)
    expect(calls).toContainEqual(['eq', 'status', 'pending'])
    expect(calls).toContainEqual(['not', 'household_id', 'is', null])
    expect(calls).toContainEqual(['lte', 'due_date', '2026-10-07'])
  })

  it('reads a missing count as zero', async () => {
    const { client } = recordingClient(null as never)

    expect(await countPendingSharedRecurrenceInstances(client, '2026-10-07')).toBe(0)
  })
})
