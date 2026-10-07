import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { rollCardPeriodsForward } from '../src/internal/card-periods'

/**
 * Lazy roll-forward of a card's calendar (I-CRED-12). The reads call it with
 * today; it must write nothing on a card that is up to date, every missing
 * period on a card that sat unused, and survive a concurrent writer.
 */

const LAST = { start_date: '2026-06-26', end_date: '2026-07-25', due_date: '2026-08-07' }
const FIRST = { start_date: '2026-05-26', end_date: '2026-06-25', due_date: '2026-07-08' }
const today = new Date(2026, 9, 6)

function makeClient(opts: { conflictOnStart?: string } = {}) {
  const inserted: Array<Record<string, unknown>> = []
  const client = {
    from() {
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (row.start_date === opts.conflictOnStart) {
                return { data: null, error: { code: '23505' } }
              }
              inserted.push(row)
              return { data: { id: `new-${inserted.length}` }, error: null }
            },
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: (_col: string, start: string) => ({
              single: async () => ({
                data: { id: 'theirs', start_date: start, end_date: '2026-08-24', due_date: '2026-09-06' },
                error: null,
              }),
            }),
          }),
        }),
      }
    },
  } as unknown as GranaSupabaseClient
  return { client, inserted }
}

describe('rollCardPeriodsForward', () => {
  it('writes nothing when a period already reaches the date', async () => {
    const { client, inserted } = makeClient()
    const created = await rollCardPeriodsForward(client, 'acc', '2026-07-20', today, [FIRST, LAST])
    expect(created).toEqual([])
    expect(inserted).toHaveLength(0)
  })

  it('creates every missing estimated period up to the date', async () => {
    const { client, inserted } = makeClient()
    const created = await rollCardPeriodsForward(client, 'acc', '2026-10-06', today, [FIRST, LAST])
    expect(inserted).toHaveLength(3)
    expect(inserted.every((r) => r.is_estimated === true && r.account_id === 'acc')).toBe(true)
    const last = created[created.length - 1]
    expect(last.start_date <= '2026-10-06' && '2026-10-06' <= last.end_date).toBe(true)
  })

  it('reads back the row a concurrent request created instead of failing', async () => {
    const { client, inserted } = makeClient({ conflictOnStart: '2026-07-26' })
    const created = await rollCardPeriodsForward(client, 'acc', '2026-10-06', today, [FIRST, LAST])
    expect(created[0].id).toBe('theirs')
    expect(inserted).toHaveLength(2)
  })
})
