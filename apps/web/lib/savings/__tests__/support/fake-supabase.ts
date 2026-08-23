import type { GranaSupabaseClient } from '@grana/supabase'

type AvailableRow = {
  currency_code: string
  accounts_net: number
  reserved: number
  available: number
}

export type InsertedReserve = {
  user_id: string
  currency_code: string
  amount: number
  date: string
}

/**
 * Minimal stand-in for the Supabase client, covering exactly the two calls the
 * savings mutations make: the `get_available_sums` RPC that supplies the cap and
 * the floor, and the insert into `availability_reserve`.
 *
 * It records every insert so the tests can assert the SIGN that was persisted —
 * the direction is chosen by the verb the user tapped, never by a sign typed into
 * the amount field, and that is only observable at the row level.
 */
export function fakeSupabase(options: {
  available?: AvailableRow[]
  insertError?: { code: string }
}) {
  const inserted: InsertedReserve[] = []

  const client = {
    rpc: async (fn: string) => {
      if (fn !== 'get_available_sums') throw new Error(`unexpected rpc: ${fn}`)
      return { data: options.available ?? [], error: null }
    },
    from: (table: string) => {
      if (table !== 'availability_reserve') throw new Error(`unexpected table: ${table}`)
      return {
        insert: (payload: InsertedReserve) => ({
          select: () => ({
            single: async () => {
              if (options.insertError) return { data: null, error: options.insertError }
              inserted.push(payload)
              return { data: { id: 'reserve-1' }, error: null }
            },
          }),
        }),
      }
    },
  }

  return { supabase: client as unknown as GranaSupabaseClient, inserted }
}

export const arsRow = (accountsNet: number, reserved: number): AvailableRow => ({
  currency_code: 'ARS',
  accounts_net: accountsNet,
  reserved,
  available: accountsNet - reserved,
})
