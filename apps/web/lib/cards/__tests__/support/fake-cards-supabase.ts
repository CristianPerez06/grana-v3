import type { GranaSupabaseClient } from '@grana/supabase'

/**
 * Stand-in de Supabase para el camino de pago de resumen.
 *
 * `payCardPeriod` encadena lecturas (`card_periods`, `accounts`, `period_payments`,
 * `transactions`) y después llama a los dos RPC. El fake de savings solo cubre RPCs,
 * así que este agrega el builder encadenable —`.select().eq().limit().maybeSingle()`—
 * resolviendo por tabla.
 *
 * Lo que importa que registre es **qué se le mandó al RPC**: el contrato del payload es
 * justamente lo que no se puede verificar con typecheck (la action recibe `unknown`), y
 * fue lo que casi se rompe en silencio al cambiarlo.
 */

export type RpcCall = { name: string; args: Record<string, unknown> }

type Fixture = {
  period?: Record<string, unknown> | null
  account?: Record<string, unknown> | null
  existingPayment?: { id: string } | null
  laterPeriods?: Array<Record<string, unknown>>
  laterPayments?: Array<{ period_id: string }>
  nextNextTx?: { id: string } | null
  calendarError?: { message?: string; code?: string; details?: string } | null
  payError?: { message?: string; code?: string; details?: string } | null
  payResult?: Record<string, unknown> | null
  revertError?: { message?: string; code?: string; details?: string } | null
  revertResult?: Record<string, unknown> | null
}

const PERIOD = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  account_id: 'bbbbbbbb-0000-4000-8000-000000000001',
  start_date: '2026-07-08',
  end_date: '2026-08-07',
  due_date: '2026-08-14',
}

const ACCOUNT = { user_id: 'user-1', name: 'Visa Santander', stamp_tax_rate: null }

export function fakeCardsSupabase(fixture: Fixture = {}) {
  const rpcCalls: RpcCall[] = []
  const updates: Array<{ table: string; values: Record<string, unknown> }> = []

  const period = fixture.period === undefined ? PERIOD : fixture.period
  const account = fixture.account === undefined ? ACCOUNT : fixture.account

  /** Qué devuelve cada tabla, según si la consulta pide una fila o varias. */
  const resolve = (table: string, single: boolean) => {
    if (table === 'card_periods') {
      // Una fila = el período que se paga; varias = los posteriores para el plan.
      return single ? { data: period, error: null } : { data: fixture.laterPeriods ?? [], error: null }
    }
    if (table === 'accounts') return { data: account, error: null }
    if (table === 'period_payments') {
      return single
        ? { data: fixture.existingPayment ?? null, error: null }
        : { data: fixture.laterPayments ?? [], error: null }
    }
    if (table === 'transactions') {
      return single ? { data: fixture.nextNextTx ?? null, error: null } : { data: [], error: null }
    }
    return { data: null, error: null }
  }

  const builder = (table: string) => {
    let single = false
    const chain: Record<string, unknown> = {}
    const passthrough = ['select', 'eq', 'in', 'gt', 'lte', 'order', 'limit', 'is', 'neq']
    for (const m of passthrough) chain[m] = () => chain
    chain.single = () => {
      single = true
      return chain
    }
    chain.maybeSingle = () => {
      single = true
      return chain
    }
    chain.update = (values: Record<string, unknown>) => {
      updates.push({ table, values })
      return chain
    }
    // Thenable: la cadena se resuelve donde el código la espere.
    chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve(table, single)).then(onFulfilled)
    return chain
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      if (name === 'confirm_running_cycle') {
        return fixture.calendarError
          ? { data: null, error: fixture.calendarError }
          : { data: { status: 'applied' }, error: null }
      }
      if (name === 'pay_card_period_legs') {
        if (fixture.payError) return { data: null, error: fixture.payError }
        return {
          data: fixture.payResult ?? {
            payment_group_id: 'group-1',
            transaction_ids: ['tx-1'],
            settled: true,
            pending_ars: 0,
            pending_usd: 0,
            stamp_tax_base_ars: null,
          },
          error: null,
        }
      }
      if (name === 'revert_card_period_payment') {
        return fixture.revertError
          ? { data: null, error: fixture.revertError }
          : { data: fixture.revertResult ?? null, error: null }
      }
      return { data: null, error: null }
    },
  }

  return { supabase: client as unknown as GranaSupabaseClient, rpcCalls, updates }
}
