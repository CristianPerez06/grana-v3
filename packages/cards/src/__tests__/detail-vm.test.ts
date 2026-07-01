import { describe, it, expect } from 'vitest'
import { resolveCardDetailState } from '../detail-vm'
import type { CreditCardDetail, CardPeriodDetail } from '../detail-queries'

// ── Test factories ────────────────────────────────────────────────────────────

type PeriodOver = {
  id?: string
  start_date?: string
  end_date?: string
  due_date?: string
  has_payment?: boolean
  tx_count?: number
}

const mkBarePeriod = (over: PeriodOver = {}) => ({
  id: over.id ?? 'p1',
  start_date: over.start_date ?? '2026-06-01',
  end_date: over.end_date ?? '2026-06-30',
  due_date: over.due_date ?? '2026-07-10',
  has_payment: over.has_payment ?? false,
  tx_count: over.tx_count ?? 0,
  is_estimated: false,
})

type DetailOver = PeriodOver & {
  variant?: string
  alert?: 'red' | 'amber' | 'none'
  pendingAmountARS?: number
  pendingAmountUSD?: number
  installmentsARS?: number
}

const mkDetailPeriod = (over: DetailOver = {}): CardPeriodDetail => {
  const bare = mkBarePeriod(over)
  const transactions = over.installmentsARS
    ? [
        {
          id: 'tx-cuota',
          type: 'expense',
          amount: over.installmentsARS,
          currency_code: 'ARS',
          date: '2026-06-10',
          status: 'pending',
          description: null,
          category_id: null,
          is_parent: false,
          installment_n: 1,
          installments_total: 3,
          fx_rate_to_ars: null,
          received_at: null,
          cancelled_at: null,
        },
      ]
    : []
  return {
    ...bare,
    variant: over.variant ?? 'actual',
    alert: over.alert ?? 'none',
    pendingAmountARS: over.pendingAmountARS ?? 0,
    pendingAmountUSD: over.pendingAmountUSD ?? 0,
    paidAmountARS: 0,
    paidAmountUSD: 0,
    stampTaxRate: null,
    paymentDate: null,
    paymentRecordId: null,
    paymentExpenseId: null,
    nextPeriodStart: null,
    nextPeriodIsPaid: false,
    transactions,
  } as unknown as CardPeriodDetail
}

type CardOver = {
  is_active?: boolean
  credit_limit?: number | null
  hasPendingDebt?: boolean
  usd?: boolean
  /** Bare periods (CardPeriodWithPayment) on the account. */
  periods?: ReturnType<typeof mkBarePeriod>[]
}

const mkDetail = (over: CardOver = {}): CreditCardDetail =>
  ({
    id: 'card-1',
    name: 'Galicia Visa',
    type: 'credit',
    is_active: over.is_active ?? true,
    credit_limit: over.credit_limit ?? 100_000,
    network_id: null,
    other_network_name: null,
    institution_id: 'inst-1',
    institution: { name: 'Galicia', brand_color: '#ff7a00', icon_type: null },
    color_key: null,
    icon_key: null,
    created_at: '2026-01-01',
    currencies: over.usd
      ? [{ currency_code: 'USD', is_active: true }]
      : [{ currency_code: 'ARS', is_active: true }],
    periods: over.periods ?? [mkBarePeriod()],
    today: new Date(2026, 5, 15),
    debtCheck: over.hasPendingDebt
      ? { hasPendingDebt: true, reason: 'pending_debt' }
      : { hasPendingDebt: false },
  }) as unknown as CreditCardDetail

const noInstallments = { items: [], totalRemaining: 0 }

// ── new-card ────────────────────────────────────────────────────────────────────

describe('resolveCardDetailState › new-card', () => {
  it('is new-card when active and no history', () => {
    const state = resolveCardDetailState({
      cardDetail: mkDetail({ is_active: true, periods: [mkBarePeriod({ tx_count: 0 })] }),
      periods: [mkDetailPeriod({ tx_count: 0 })],
      installments: noInstallments,
      todayISO: '2026-06-15',
    })
    expect(state.kind).toBe('new-card')
    if (state.kind !== 'new-card') return
    expect(state.shared.cardHasHistory).toBe(false)
    expect(state.shared.institutionName).toBe('Galicia')
    expect(state.shared.headerTone).toBe('ok')
    expect(state.shared.committedARS).toBe(0)
    expect(typeof state.shared.accent).toBe('string')
  })
})

// ── archived-empty ──────────────────────────────────────────────────────────────

describe('resolveCardDetailState › archived-empty', () => {
  it('is archived-empty when inactive and nothing pending', () => {
    const state = resolveCardDetailState({
      cardDetail: mkDetail({ is_active: false, periods: [mkBarePeriod({ tx_count: 0 })] }),
      periods: [mkDetailPeriod({ tx_count: 0 })],
      installments: noInstallments,
      todayISO: '2026-06-15',
    })
    expect(state.kind).toBe('archived-empty')
    if (state.kind !== 'archived-empty') return
    expect(state.shared.headerTone).toBe('ok')
  })

  it('falls through to active when inactive but with pending debt', () => {
    const periods = [mkBarePeriod({ tx_count: 4, has_payment: false })]
    const state = resolveCardDetailState({
      cardDetail: mkDetail({ is_active: false, hasPendingDebt: true, periods }),
      periods: [mkDetailPeriod({ tx_count: 4, pendingAmountARS: 9000 })],
      installments: noInstallments,
      todayISO: '2026-06-15',
    })
    expect(state.kind).toBe('active')
  })
})

// ── active ──────────────────────────────────────────────────────────────────────

describe('resolveCardDetailState › active', () => {
  it('builds the cycle counters, committedARS and installments for the open statement', () => {
    const bare = [mkBarePeriod({ tx_count: 3 })]
    const state = resolveCardDetailState({
      cardDetail: mkDetail({ is_active: true, periods: bare, usd: true }),
      periods: [mkDetailPeriod({ tx_count: 3, pendingAmountARS: 5000, installmentsARS: 1500 })],
      installments: { items: [], totalRemaining: 0 },
      todayISO: '2026-06-15',
    })
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') return
    const { vm, shared } = state
    // Cycle: 06-01 → 06-30 is 29 days; today 06-15 is day 14; closes in 15 days.
    expect(vm.cursoCycleTotal).toBe(29)
    expect(vm.cursoCycleDay).toBe(14)
    expect(vm.cursoDaysToClose).toBe(15)
    // Only curso is present (no apagar / prox) → committed = curso pending ARS.
    expect(vm.committedARS).toBe(5000)
    expect(shared.committedARS).toBe(5000)
    expect(vm.cursoInstallmentsARS).toBe(1500)
    expect(vm.apagar).toBeNull()
    expect(vm.prox).toBeNull()
    expect(vm.hasUSD).toBe(true)
    expect(vm.creditLimit).toBe(100_000)
  })
})
