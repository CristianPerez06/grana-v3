import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { rollActiveCardsToToday } from '../queries'

/** The card reads roll an unused card's calendar up to today before reading. */

const today = new Date(2026, 9, 6) // 2026-10-06

function makeClient() {
  const inserted: Array<Record<string, unknown>> = []
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserted.push(row)
            return { data: { id: `new-${inserted.length}` }, error: null }
          },
        }),
      }),
    }),
  } as unknown as GranaSupabaseClient
  return { client, inserted }
}

const stalled = [
  { account_id: 'mc', start_date: '2026-05-26', end_date: '2026-06-25', due_date: '2026-07-08' },
  { account_id: 'mc', start_date: '2026-06-26', end_date: '2026-07-25', due_date: '2026-08-07' },
]
const upToDate = [
  { account_id: 'visa', start_date: '2026-08-25', end_date: '2026-09-24', due_date: '2026-10-06' },
  { account_id: 'visa', start_date: '2026-09-25', end_date: '2026-10-23', due_date: '2026-11-05' },
  { account_id: 'visa', start_date: '2026-10-24', end_date: '2026-11-23', due_date: '2026-12-05' },
]

describe('rollActiveCardsToToday', () => {
  it('writes nothing when every card already covers today', async () => {
    const { client, inserted } = makeClient()
    expect(await rollActiveCardsToToday(client, [{ id: 'visa', is_active: true }], upToDate, today)).toBe(false)
    expect(inserted).toHaveLength(0)
  })

  it('adds the "próximo resumen" when the cycle in course is the last one', async () => {
    const { client, inserted } = makeClient()
    const current = upToDate.slice(0, 2)
    expect(await rollActiveCardsToToday(client, [{ id: 'visa', is_active: true }], current, today)).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ account_id: 'visa', start_date: '2026-10-24', is_estimated: true })
  })

  it('rolls an unused active card up to the cycle containing today, plus the next one', async () => {
    const { client, inserted } = makeClient()
    const cards = [
      { id: 'visa', is_active: true },
      { id: 'mc', is_active: true },
    ]
    expect(await rollActiveCardsToToday(client, cards, [...upToDate, ...stalled], today)).toBe(true)
    expect(inserted.every((r) => r.account_id === 'mc')).toBe(true)
    const cover = inserted[inserted.length - 2]
    expect((cover.start_date as string) <= '2026-10-06').toBe(true)
    expect((cover.end_date as string) >= '2026-10-06').toBe(true)
    const next = inserted[inserted.length - 1]
    expect((next.start_date as string) > '2026-10-06').toBe(true)
  })

  it('leaves archived cards alone', async () => {
    const { client, inserted } = makeClient()
    expect(await rollActiveCardsToToday(client, [{ id: 'mc', is_active: false }], stalled, today)).toBe(false)
    expect(inserted).toHaveLength(0)
  })
})
