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

const TODAY = new Date(2026, 6, 12) // 2026-07-12, after the paid period's close
const PERIOD_ID = '33333333-3333-4333-8333-333333333333'
const BANK_ID = '44444444-4444-4444-8444-444444444444'
const payInput = (over: Record<string, unknown> = {}) => ({
  period_id: PERIOD_ID,
  payment_account_id: BANK_ID,
  amount: 10000,
  payment_date: '2026-07-10',
  next_end_date: '2026-07-31',
  next_due_date: '2026-08-10',
  ...over,
})

// A closed period (end 2026-06-30 < today) owned by the user, unpaid.
const closedPeriod = { id: PERIOD_ID, account_id: 'acc-1', start_date: '2026-06-01', end_date: '2026-06-30', due_date: '2026-07-10' }

describe('payCardPeriod › guards', () => {
  it('period_not_found', async () => {
    const { supabase } = makeSupabase((c) =>
      c.table === 'card_periods' ? { data: null, error: { code: 'PGRST116' } } : OK,
    )
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_found' })
  })

  it('period_no_access when the account is not the user\'s', async () => {
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
      if (c.table === 'accounts') return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'period_payments') return { data: { id: 'pay1' }, error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_already_paid' })
  })

  it('period_not_closed when the period is still open', async () => {
    const openPeriod = { ...closedPeriod, end_date: '2026-07-31', due_date: '2026-08-10' }
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: openPeriod, error: null }
      if (c.table === 'accounts') return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_closed' })
  })

  it('payment_from_card when the payment account is a credit card', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: closedPeriod, error: null }
      if (c.table === 'accounts' && c.cols.includes('stamp_tax_rate'))
        return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'accounts' && c.cols.includes('is_active'))
        return { data: { type: 'credit', is_active: true }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.payment_from_card' })
  })

  it('usd_fx_required when there is USD debt but no rate', async () => {
    const { supabase } = makeSupabase((c) => {
      if (c.table === 'card_periods') return { data: closedPeriod, error: null }
      if (c.table === 'accounts' && c.cols.includes('stamp_tax_rate'))
        return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: null }, error: null }
      if (c.table === 'accounts' && c.cols.includes('is_active'))
        return { data: { type: 'bank', is_active: true }, error: null }
      if (c.table === 'period_payments') return { data: null, error: null }
      if (c.table === 'transactions' && c.op === 'select')
        return { data: [{ type: 'expense', amount: 50, currency_code: 'USD', status: 'pending', received_at: null, cancelled_at: null }], error: null }
      return OK
    })
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput({ fx_rate_to_ars: null }), today: TODAY })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.usd_fx_required' })
  })
})

describe('payCardPeriod › happy path + stamp tax', () => {
  // A running next period whose dates already equal the confirmed ones → no
  // cascade; plus a nextNext so no eager estimated is created. Minimal writes.
  const laterPeriods = [
    { id: 'per-2', start_date: '2026-07-01', end_date: '2026-07-31', due_date: '2026-08-10', is_estimated: true },
    { id: 'per-3', start_date: '2026-08-01', end_date: '2026-08-31', due_date: '2026-09-10', is_estimated: true },
  ]

  const baseHandler =
    (opts: { stampRate?: number | null } = {}) =>
    (c: Ctx) => {
      if (c.table === 'card_periods' && c.op === 'select' && c.cols.includes('account_id'))
        return { data: closedPeriod, error: null }
      if (c.table === 'card_periods' && c.op === 'select')
        return { data: laterPeriods, error: null } // laterPeriods lookup (list)
      if (c.table === 'card_periods' && c.op === 'update') return OK // confirm running cycle
      if (c.table === 'accounts' && c.op === 'select' && c.cols.includes('stamp_tax_rate'))
        return { data: { user_id: USER, name: 'Galicia', stamp_tax_rate: opts.stampRate ?? null }, error: null }
      if (c.table === 'accounts' && c.op === 'select' && c.cols.includes('is_active'))
        return { data: { type: 'bank', is_active: true }, error: null }
      if (c.table === 'accounts' && c.op === 'update') return OK // remember stamp_tax_rate
      if (c.table === 'period_payments' && c.op === 'select' && c.terminal === 'maybeSingle')
        return { data: null, error: null } // not-yet-paid check
      if (c.table === 'period_payments' && c.op === 'select') return { data: [], error: null } // laterPayments
      if (c.table === 'period_payments' && c.op === 'insert') return OK
      if (c.table === 'categories') return { data: { id: 'cat-imp' }, error: null }
      if (c.table === 'subcategories') return { data: { id: 'sub-sello' }, error: null }
      if (c.table === 'transactions' && c.op === 'select' && c.terminal === 'maybeSingle')
        return { data: null, error: null } // nextNext has no tx
      if (c.table === 'transactions' && c.op === 'select')
        return { data: [{ type: 'expense', amount: 10000, currency_code: 'ARS', status: 'pending', received_at: null, cancelled_at: null }], error: null }
      if (c.table === 'transactions' && c.op === 'insert')
        return { data: { id: c.cols === '' ? 'tx' : 'tx' }, error: null }
      if (c.table === 'transactions' && c.op === 'update') return OK // sweep to paid
      return OK
    }

  it('pays a simple ARS statement (no stamp tax)', async () => {
    const { supabase, calls } = makeSupabase(baseHandler())
    const result = await payCardPeriod({ supabase, userId: USER, input: payInput(), today: TODAY })
    expect(result).toEqual({ ok: true, expenseId: 'tx' })
    // The payment expense + the period_payment were written; no stamp tx.
    expect(calls.inserts.filter((i) => i.table === 'transactions')).toHaveLength(1)
    expect(calls.inserts.some((i) => i.table === 'period_payments')).toBe(true)
  })

  it('inserts the stamp tax and remembers the derived rate on the first payment', async () => {
    // base ARS = 10000; sello 210 → derived rate 0.021, persisted because the
    // card had no remembered rate yet.
    const { supabase, calls } = makeSupabase(baseHandler({ stampRate: null }))
    const result = await payCardPeriod({
      supabase,
      userId: USER,
      input: payInput({ stamp_tax_amount: 210 }),
      today: TODAY,
    })
    expect(result).toEqual({ ok: true, expenseId: 'tx' })
    // Two transaction inserts: the payment expense + the stamp-tax movement.
    expect(calls.inserts.filter((i) => i.table === 'transactions')).toHaveLength(2)
    const stampInsert = calls.inserts
      .map((i) => i.payload as Record<string, unknown>)
      .find((p) => p?.description === 'Impuesto de sellos')
    expect(stampInsert).toMatchObject({ card_period_id: PERIOD_ID, currency_code: 'ARS', status: 'pending' })
    // The derived rate (210 / 10000 = 0.021) was persisted on the account.
    const rateUpdate = calls.updates.find(
      (u) => u.table === 'accounts' && (u.payload as Record<string, unknown>).stamp_tax_rate != null,
    )
    expect((rateUpdate?.payload as Record<string, number>).stamp_tax_rate).toBeCloseTo(0.021, 6)
  })

  it('does not overwrite an existing remembered stamp rate', async () => {
    const { supabase, calls } = makeSupabase(baseHandler({ stampRate: 0.012 }))
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
})
