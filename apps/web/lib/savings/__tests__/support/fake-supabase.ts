import type { GranaSupabaseClient } from '@grana/supabase'

type AvailableRow = {
  currency_code: string
  accounts_net: number
  reserved: number
  available: number
}

export type PurposeRow = {
  purpose_id: string | null
  purpose_name: string | null
  purpose_icon: string | null
  currency_code: string
  reserved: number
}

export type InsertedReserve = {
  user_id: string
  currency_code: string
  amount: number
  date: string
  purpose_id: string | null
}

/**
 * Minimal stand-in for the Supabase client, covering exactly what the savings
 * mutations touch: the `get_available_sums` RPC that supplies the cap, the
 * `get_purpose_sums` RPC that supplies the floor, the ownership check on
 * `savings_purpose`, and the insert into `availability_reserve`.
 *
 * It records every insert so the tests can assert the SIGN that was persisted —
 * the direction is chosen by the verb the user tapped, never by a sign typed into
 * the amount field, and that is only observable at the row level.
 *
 * When `purposes` is omitted, the purpose sums are derived by putting ALL the
 * reserved money in the «Sin destino» bucket. That is not a shortcut: it is
 * exactly the state of a database before phase 2, where every reserve is
 * untagged — so the phase-1 tests keep asserting a real situation instead of a
 * fixture that no longer exists.
 */
export function fakeSupabase(options: {
  available?: AvailableRow[]
  purposes?: PurposeRow[]
  /** Purpose ids the user owns. Anything else reads as another user's. */
  ownedPurposeIds?: string[]
  insertError?: { code: string }
}) {
  const inserted: InsertedReserve[] = []

  const untagged = (): PurposeRow[] =>
    (options.available ?? [])
      .filter((row) => row.reserved !== 0)
      .map((row) => ({
        purpose_id: null,
        purpose_name: null,
        purpose_icon: null,
        currency_code: row.currency_code,
        reserved: row.reserved,
      }))

  const client = {
    rpc: async (fn: string) => {
      if (fn === 'get_available_sums') return { data: options.available ?? [], error: null }
      if (fn === 'get_purpose_sums') return { data: options.purposes ?? untagged(), error: null }
      throw new Error(`unexpected rpc: ${fn}`)
    },
    from: (table: string) => {
      if (table === 'savings_purpose') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: (options.ownedPurposeIds ?? []).includes(value) ? { id: value } : null,
                error: null,
              }),
            }),
          }),
        }
      }
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

export const purposeRow = (
  reserved: number,
  opts: { id?: string | null; name?: string | null; currency?: string } = {},
): PurposeRow => ({
  purpose_id: opts.id ?? null,
  purpose_name: opts.name ?? null,
  purpose_icon: null,
  currency_code: opts.currency ?? 'ARS',
  reserved,
})
