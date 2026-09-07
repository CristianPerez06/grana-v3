import { describe, it, expect } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import {
  updateCreditCard,
  updatePeriodDates,
  updateInstallmentParent,
  deleteInstallmentParent,
} from '../mutations'
import { payCardPeriod } from '../pay-card-period'

// ── Flexible chainable Supabase fake ────────────────────────────────────────────
// Each builder records its (table, op, select columns, filters, payload) and, on
// `await`/single()/maybeSingle(), asks the test's `handler(ctx)` for `{data,error}`.
// `calls` records every insert/update/delete for assertions.

type Ctx = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  cols: string
  filters: Record<string, unknown>
  ins: Record<string, unknown[]>
  payload: unknown
  terminal: 'single' | 'maybeSingle' | 'list'
}

type Handler = (ctx: Ctx) => { data: unknown; error: unknown }
type RpcHandler = (fn: string, args: unknown) => { data: unknown; error: unknown }

function makeSupabase(handler: Handler, rpcHandler?: RpcHandler) {
  const calls = {
    inserts: [] as Array<{ table: string; payload: unknown }>,
    updates: [] as Array<{ table: string; payload: unknown; filters: Record<string, unknown> }>,
    deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>,
    rpcs: [] as Array<{ fn: string; args: unknown }>,
  }

  function builder(table: string) {
    const ctx: Ctx = { table, op: 'select', cols: '', filters: {}, ins: {}, payload: undefined, terminal: 'list' }

    const run = () => {
      if (ctx.op === 'insert') calls.inserts.push({ table, payload: ctx.payload })
      if (ctx.op === 'update') calls.updates.push({ table, payload: ctx.payload, filters: ctx.filters })
      if (ctx.op === 'delete') calls.deletes.push({ table, filters: ctx.filters })
      return handler(ctx)
    }

    const b: Record<string, unknown> = {
      select: (cols?: string) => {
        if (ctx.op === 'select') ctx.cols = cols ?? ''
        return b
      },
      insert: (payload: unknown) => {
        ctx.op = 'insert'
        ctx.payload = payload
        return b
      },
      update: (payload: unknown) => {
        ctx.op = 'update'
        ctx.payload = payload
        return b
      },
      delete: () => {
        ctx.op = 'delete'
        return b
      },
      eq: (col: string, val: unknown) => {
        ctx.filters[col] = val
        return b
      },
      in: (col: string, vals: unknown[]) => {
        ctx.ins[col] = vals
        return b
      },
      gt: () => b,
      lte: () => b,
      is: () => b,
      order: () => b,
      limit: () => b,
      single: () => {
        ctx.terminal = 'single'
        return b
      },
      maybeSingle: () => {
        ctx.terminal = 'maybeSingle'
        return b
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(onFulfilled, onRejected),
    }
    return b
  }

  const supabase = {
    from: (t: string) => builder(t),
    rpc: (fn: string, args: unknown) => {
      calls.rpcs.push({ fn, args })
      return Promise.resolve(rpcHandler ? rpcHandler(fn, args) : OK)
    },
  } as unknown as GranaSupabaseClient
  return { supabase, calls }
}

const OK = { data: null, error: null }
const USER = 'user-1'

// ── updateCreditCard ────────────────────────────────────────────────────────────

describe('updateCreditCard', () => {
  it('rejects immutable network fields with a messageKey (no db)', async () => {
    const { supabase, calls } = makeSupabase(() => OK)
    const result = await updateCreditCard({ supabase, userId: USER, id: 'c1', input: { network_id: 'x' } })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.network_immutable' })
    expect(calls.updates).toHaveLength(0)
  })

  it('rejects an out-of-range name length', async () => {
    const { supabase } = makeSupabase(() => OK)
    const result = await updateCreditCard({ supabase, userId: USER, id: 'c1', input: { name: 'x'.repeat(51) } })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.name_length' })
  })

  it('rejects a non-positive credit limit', async () => {
    const { supabase } = makeSupabase(() => OK)
    const result = await updateCreditCard({ supabase, userId: USER, id: 'c1', input: { credit_limit: 0 } })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.limit_positive' })
  })

  it('is a no-op ok when there is nothing to update', async () => {
    const { supabase, calls } = makeSupabase(() => OK)
    const result = await updateCreditCard({ supabase, userId: USER, id: 'c1', input: {} })
    expect(result).toEqual({ ok: true })
    expect(calls.updates).toHaveLength(0)
  })

  it('applies name + limit and returns ok', async () => {
    const { supabase, calls } = makeSupabase(() => OK)
    const result = await updateCreditCard({
      supabase,
      userId: USER,
      id: 'c1',
      input: { name: '  Visa  ', credit_limit: 100000 },
    })
    expect(result).toEqual({ ok: true })
    expect(calls.updates[0].payload).toMatchObject({ name: 'Visa', credit_limit: 100000 })
  })

  it('maps a Postgres error to errorCode', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { code: '23505' } }))
    const result = await updateCreditCard({ supabase, userId: USER, id: 'c1', input: { name: 'Visa' } })
    expect(result).toEqual({ ok: false, errorCode: '23505' })
  })
})

// ── updatePeriodDates ─────────────────────────────────────────────────────────

const validDates = { end_date: '2026-06-30', due_date: '2026-07-10' }

describe('updatePeriodDates', () => {
  it('returns fieldErrors for invalid input', async () => {
    const { supabase } = makeSupabase(() => OK)
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeTruthy()
  })

  it('period_not_found when the period select errors', async () => {
    const { supabase } = makeSupabase((c) =>
      c.table === 'card_periods' ? { data: null, error: { code: 'PGRST116' } } : OK,
    )
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: validDates })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_found' })
  })

  it('period_no_access when the owner check is empty', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods')
        return { data: { account_id: 'a1', start_date: '2026-06-01', end_date: '2026-06-30', due_date: '2026-07-10' }, error: null }
      if (c.table === 'accounts') return { data: null, error: null }
      return OK
    })
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: validDates })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_no_access' })
  })

  it('period_paid_dates_locked when the period is already paid', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods')
        return { data: { account_id: 'a1', start_date: '2026-06-01', end_date: '2026-06-30', due_date: '2026-07-10' }, error: null }
      if (c.table === 'accounts') return { data: { id: 'a1' }, error: null }
      if (c.table === 'period_payments') return { data: { id: 'pay1' }, error: null }
      return OK
    })
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: validDates })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_paid_dates_locked' })
  })

  it('close_after_start when end_date is not after the period start', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods')
        return { data: { account_id: 'a1', start_date: '2026-07-01', end_date: '2026-06-30', due_date: '2026-07-10' }, error: null }
      if (c.table === 'accounts') return { data: { id: 'a1' }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      return OK
    })
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: validDates })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.close_after_start' })
  })

  it('updates the dates when there is no next period', async () => {
    const { supabase, calls } = makeSupabase((c) => {
      if (c.table === 'card_periods' && c.op === 'select' && c.cols.includes('account_id'))
        return { data: { account_id: 'a1', start_date: '2026-06-01', end_date: '2026-06-30', due_date: '2026-07-10' }, error: null }
      if (c.table === 'accounts') return { data: { id: 'a1' }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      // next-period lookup (maybeSingle) → none
      if (c.table === 'card_periods' && c.op === 'select') return { data: null, error: null }
      return OK
    })
    const result = await updatePeriodDates({ supabase, userId: USER, periodId: 'p1', input: validDates })
    expect(result).toEqual({ ok: true })
    const upd = calls.updates.find((u) => u.table === 'card_periods')
    expect(upd?.payload).toMatchObject({ end_date: '2026-06-30', due_date: '2026-07-10', is_estimated: false })
  })
})

// ── updateInstallmentParent ─────────────────────────────────────────────────────

describe('updateInstallmentParent', () => {
  it('installment_not_found when the parent is missing', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { code: 'PGRST116' } }))
    const result = await updateInstallmentParent({ supabase, userId: USER, parentId: 'x', input: {} })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.installment_not_found' })
  })

  it('blocks an amount change when a child is already paid', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'transactions' && c.op === 'select' && c.cols.includes('installments_total'))
        return { data: { id: 'par', installments_total: 3 }, error: null }
      if (c.table === 'transactions' && c.op === 'select')
        return { data: [{ id: 'ch1', status: 'paid', installment_n: 1, amount: 100 }], error: null }
      return OK
    })
    const result = await updateInstallmentParent({ supabase, userId: USER, parentId: 'par', input: { amount: 300 } })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.installment_amount_locked' })
  })

  it('rejects a non-positive amount', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'transactions' && c.op === 'select' && c.cols.includes('installments_total'))
        return { data: { id: 'par', installments_total: 3 }, error: null }
      if (c.table === 'transactions' && c.op === 'select')
        return { data: [{ id: 'ch1', status: 'pending', installment_n: 1, amount: 100 }], error: null }
      return OK
    })
    const result = await updateInstallmentParent({ supabase, userId: USER, parentId: 'par', input: { amount: 0 } })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.amount_positive' })
  })

  it('propagates category to children and returns ok (sharedTouched false)', async () => {
    const { supabase, calls } = makeSupabase((c) => {
      if (c.table === 'transactions' && c.op === 'select' && c.cols.includes('installments_total'))
        return { data: { id: 'par', installments_total: 3 }, error: null }
      if (c.table === 'transactions' && c.op === 'select')
        return { data: [{ id: 'ch1', status: 'pending', installment_n: 1, amount: 100 }], error: null }
      return OK
    })
    const result = await updateInstallmentParent({
      supabase,
      userId: USER,
      parentId: 'par',
      input: { category_id: 'cat-9' },
    })
    expect(result).toEqual({ ok: true, sharedTouched: false })
    // parent + children both updated with the new category
    expect(calls.updates.filter((u) => u.table === 'transactions')).toHaveLength(2)
  })
})

// ── updateInstallmentParent › unshare (atomic RPC) ──────────────────────────────

describe('updateInstallmentParent › unshare', () => {
  const parentAndChildren = (c: Ctx) => {
    if (c.table === 'transactions' && c.op === 'select' && c.cols.includes('installments_total'))
      return { data: { id: 'par', installments_total: 3 }, error: null }
    if (c.table === 'transactions' && c.op === 'select')
      return { data: [{ id: 'ch1', status: 'pending', installment_n: 1, amount: 100 }], error: null }
    return OK
  }

  it('unshares via the unshare_movement RPC — no client split delete, no direct flag flip', async () => {
    const { supabase, calls } = makeSupabase(parentAndChildren)
    const result = await updateInstallmentParent({
      supabase,
      userId: USER,
      parentId: 'par',
      input: { shared: null },
    })
    expect(result).toEqual({ ok: true, sharedTouched: true })
    // The atomic RPC is called with the parent as root.
    expect(calls.rpcs).toEqual([{ fn: 'unshare_movement', args: { p_root_id: 'par' } }])
    // The buggy client-side delete-then-flip is gone.
    expect(calls.deletes.filter((d) => d.table === 'shared_expense_split')).toHaveLength(0)
    expect(
      calls.updates.filter(
        (u) => u.table === 'transactions' && (u.payload as Record<string, unknown>).is_shared === false,
      ),
    ).toHaveLength(0)
  })

  it('maps the temporal settlement guard (GRN01) to a friendly messageKey', async () => {
    const { supabase } = makeSupabase(parentAndChildren, () => ({
      data: null,
      error: { code: 'GRN01', message: 'cannot unshare movement covered by a later settlement' },
    }))
    const result = await updateInstallmentParent({
      supabase,
      userId: USER,
      parentId: 'par',
      input: { shared: null },
    })
    expect(result).toEqual({
      ok: false,
      messageKey: 'cards.errors.shared_unshare_settlement',
      sharedTouched: true,
    })
  })

  it('maps any other unshare RPC error to shared_update_failed', async () => {
    const { supabase } = makeSupabase(parentAndChildren, () => ({
      data: null,
      error: { code: '23503', message: 'some other db error' },
    }))
    const result = await updateInstallmentParent({
      supabase,
      userId: USER,
      parentId: 'par',
      input: { shared: null },
    })
    expect(result).toEqual({
      ok: false,
      messageKey: 'cards.errors.shared_update_failed',
      messageParams: { error: 'some other db error' },
      sharedTouched: true,
    })
  })
})

// ── deleteInstallmentParent ─────────────────────────────────────────────────────

describe('deleteInstallmentParent', () => {
  it('installment_not_found when the parent is missing', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { code: 'PGRST116' } }))
    const result = await deleteInstallmentParent({ supabase, userId: USER, parentId: 'x' })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.installment_not_found' })
  })

  it('blocks deletion when a child is paid', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'transactions' && c.op === 'select' && c.terminal === 'single')
        return { data: { id: 'par' }, error: null }
      if (c.table === 'transactions' && c.op === 'select' && c.terminal === 'maybeSingle')
        return { data: { id: 'ch-paid' }, error: null }
      return OK
    })
    const result = await deleteInstallmentParent({ supabase, userId: USER, parentId: 'par' })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.installment_delete_paid' })
  })

  it('deletes the parent when no child is paid', async () => {
    const { supabase, calls } = makeSupabase((c) => {
      if (c.table === 'transactions' && c.op === 'select' && c.terminal === 'single')
        return { data: { id: 'par' }, error: null }
      if (c.table === 'transactions' && c.op === 'select' && c.terminal === 'maybeSingle')
        return { data: null, error: null }
      return OK
    })
    const result = await deleteInstallmentParent({ supabase, userId: USER, parentId: 'par' })
    expect(result).toEqual({ ok: true })
    expect(calls.deletes.some((d) => d.table === 'transactions')).toBe(true)
  })
})
// ── payCardPeriod ────────────────────────────────────────────────────────────
// El dinero de un pago lo mueve `pay_card_period_legs`, no una serie de inserts
// desde el cliente. Lo que queda de este lado —y lo único que estos tests pueden
// mirar— son tres cosas: las lecturas previas que dan buenos mensajes, la
// traducción de los errores del RPC a `messageKey`s, y la alícuota del sello, que
// es un aprendizaje y vive a propósito fuera de la transacción del dinero.
//
// La otra mitad —que el RPC efectivamente asiente lo que promete— se prueba
// contra Postgres de verdad en
// `apps/web/lib/cards/__tests__/card-payment-legs-migration.test.ts`. Duplicarlo
// acá con un doble sería probar el doble.

const TODAY = new Date(2026, 6, 12) // 2026-07-12, after the paid period's close
const PERIOD_ID = '33333333-3333-4333-8333-333333333333'
const BANK_ID = '44444444-4444-4444-8444-444444444444'

// El input viaja ANIDADO: un pago es un débito real de una cuenta, y sus
// allocations dicen qué cancela. El monto NO viaja — se deriva de las
// imputaciones, porque un importe libre puede no corresponder a ninguna deuda.
const payInput = (over: Record<string, unknown> = {}) => ({
  period_id: PERIOD_ID,
  payments: [
    {
      payment_account_id: BANK_ID,
      payment_date: '2026-07-10',
      allocations: [{ settles_currency: 'ARS', settles_amount: 10000 }],
    },
  ],
  next_end_date: '2026-07-31',
  next_due_date: '2026-08-10',
  ...over,
})

// A closed period (end 2026-06-30 < today) owned by the user, unpaid.
const closedPeriod = {
  id: PERIOD_ID,
  account_id: 'acc-1',
  start_date: '2026-06-01',
  end_date: '2026-06-30',
  due_date: '2026-07-10',
}

describe('payCardPeriod › guards de lectura', () => {
  it('period_not_found', async () => {
    const { supabase } = makeSupabase((c) =>
      c.table === 'card_periods' ? { data: null, error: { code: 'PGRST116' } } : OK,
    )
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_found' })
  })

  it('period_no_access when the period belongs to someone else', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: closedPeriod, error: null }
      if (c.table === 'accounts') return { data: null, error: { code: 'PGRST116' } }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_no_access' })
  })

  it('period_already_paid', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: closedPeriod, error: null }
      if (c.table === 'accounts')
        return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'period_payments') return { data: { id: 'pay-1' }, error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_already_paid' })
  })

  it('period_not_closed when the period is still open', async () => {
    const openPeriod = {
      ...closedPeriod,
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      due_date: '2026-08-10',
    }
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: openPeriod, error: null }
      if (c.table === 'accounts')
        return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_closed' })
  })

  it('un input con la forma plana vieja muere en la validación, sin tocar la base', async () => {
    // El monto suelto es exactamente lo que dejaba un resumen marcado como pagado
    // con cualquier número. Si esta forma volviera a pasar, el resto no importa.
    const { supabase, calls } = makeSupabase(() => OK)
    const result = await payCardPeriod({
      supabase,
      userId: USER,
      input: { period_id: PERIOD_ID, payment_account_id: BANK_ID, amount: 10000, payment_date: '2026-07-10' },
      today: TODAY,
    })
    expect(result.ok).toBe(false)
    expect(calls.rpcs).toHaveLength(0)
  })
})

// Estas reglas ya NO se chequean en el cliente: se mudaron al RPC, que es donde
// pueden garantizarse. Lo que queda acá es traducirlas, y eso también se rompe.
describe('payCardPeriod › traducción de los errores del RPC', () => {
  const upToRpc = (c: Ctx) => {
    if (c.table === 'card_periods' && c.terminal === 'single') return { data: closedPeriod, error: null }
    if (c.table === 'card_periods') return { data: [], error: null }
    if (c.table === 'accounts')
      return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
    if (c.table === 'period_payments') return { data: null, error: null }
    return OK
  }
  const rpcFailing =
    (message: string, extra: Record<string, unknown> = {}) =>
    (fn: string) =>
      fn === 'pay_card_period_legs'
        ? { data: null, error: { message, ...extra } }
        : { data: null, error: null }

  it('usd_fx_required cuando el RPC rechaza el cruce de monedas', async () => {
    const { supabase } = makeSupabase(
      upToRpc,
      rpcFailing('I-PAY-2: settling USD debt with an ARS transaction requires fx_rate_to_ars'),
    )
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.usd_fx_required' })
  })

  it('pagar un resumen desde una tarjeta lo rechaza el RPC, no el cliente', async () => {
    // La cuenta de pago ya no se lee de este lado: el RPC exige `type <> credit`
    // y levanta `payment_account_invalid`.
    const { supabase } = makeSupabase(upToRpc, rpcFailing('payment_account_invalid'))
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.payment_account_not_found' })
  })

  it('una operación que no salda el resumen nombra lo que queda', async () => {
    const { supabase } = makeSupabase(
      upToRpc,
      rpcFailing('statement_not_settled', { code: 'GRN04', details: '5000|0' }),
    )
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toMatchObject({
      ok: false,
      messageKey: 'cards.errors.statement_not_settled',
      messageParams: { ars: '5000', usd: '0' },
    })
  })
})

describe('payCardPeriod › happy path + alícuota del sello', () => {
  const baseHandler =
    (opts: { stampRate?: number | null } = {}) =>
    (c: Ctx) => {
      if (c.table === 'card_periods' && c.terminal === 'single') return { data: closedPeriod, error: null }
      if (c.table === 'card_periods') return { data: [], error: null } // sin períodos posteriores
      if (c.table === 'accounts' && c.op === 'select')
        return {
          data: { user_id: USER, name: 'Galicia', stamp_tax_rate: opts.stampRate ?? null },
          error: null,
        }
      if (c.table === 'period_payments') return { data: null, error: null }
      return OK
    }

  const rpcOk = (stampBase: number | null) => (fn: string) =>
    fn === 'pay_card_period_legs'
      ? {
          data: {
            payment_group_id: 'grp-1',
            transaction_ids: ['tx-1', 'tx-2'],
            settled: true,
            pending_ars: 0,
            pending_usd: 0,
            stamp_tax_base_ars: stampBase,
          },
          error: null,
        }
      : { data: null, error: null }

  it('devuelve las patas que escribió el RPC, y la primera como expenseId', async () => {
    // `expenseId` sobrevive para las shells que esperan un débito; `expenseIds`
    // los tiene todos, porque dos monedas pagadas por separado son dos débitos.
    const { supabase, calls } = makeSupabase(baseHandler(), rpcOk(null))
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })

    expect(result).toEqual({
      ok: true,
      expenseId: 'tx-1',
      expenseIds: ['tx-1', 'tx-2'],
      paymentGroupId: 'grp-1',
    })
    expect(calls.rpcs.map((r) => r.fn)).toContain('pay_card_period_legs')
  })

  it('deriva y recuerda la alícuota del sello en el primer pago', async () => {
    // base ARS 10000, sello 210 → 0,021. Se persiste porque la tarjeta no tenía
    // alícuota: es un aprendizaje para sugerirla sola la próxima vez.
    const { supabase, calls } = makeSupabase(baseHandler({ stampRate: null }), rpcOk(10000))
    const result = await payCardPeriod({
      supabase,
      userId: USER,
      input: payInput({ stamp_tax_amount: 210 }),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
    const rateUpdate = calls.updates.find(
      (u) => u.table === 'accounts' && (u.payload as Record<string, unknown>).stamp_tax_rate != null,
    )
    expect((rateUpdate?.payload as Record<string, number>).stamp_tax_rate).toBeCloseTo(0.021, 6)
  })

  it('no pisa una alícuota ya recordada', async () => {
    // Una corrección puntual del monto no reescribe lo aprendido.
    const { supabase, calls } = makeSupabase(baseHandler({ stampRate: 0.012 }), rpcOk(10000))
    await payCardPeriod({
      supabase,
      userId: USER,
      input: payInput({ stamp_tax_amount: 210 }),
      today: TODAY,
    })

    const rateUpdate = calls.updates.find(
      (u) => u.table === 'accounts' && 'stamp_tax_rate' in (u.payload as Record<string, unknown>),
    )
    expect(rateUpdate).toBeUndefined()
  })

  it('el sello viaja al RPC — no se inserta desde el cliente', async () => {
    // Era un insert de este lado y ahora entra en la misma transacción que el
    // dinero. Un insert acá volvería a partir la operación en dos.
    const { supabase, calls } = makeSupabase(baseHandler(), rpcOk(10000))
    await payCardPeriod({
      supabase,
      userId: USER,
      input: payInput({ stamp_tax_amount: 210 }),
      today: TODAY,
    })

    const payCall = calls.rpcs.find((r) => r.fn === 'pay_card_period_legs')
    expect((payCall?.args as Record<string, unknown>).p_stamp_tax_amount).toBe(210)
    expect(calls.inserts.filter((i) => i.table === 'transactions')).toHaveLength(0)
  })
})
