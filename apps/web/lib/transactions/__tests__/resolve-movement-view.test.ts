import { describe, it, expect } from 'vitest'
import { resolveMovementView, type MovementViewInput } from '@grana/money-logic'

const input = (over: Partial<MovementViewInput>): MovementViewInput => ({
  kind: 'expense',
  accountId: 'a',
  accountName: 'A',
  destinationAccountId: null,
  destinationAccountName: null,
  amount: 100,
  currencyCode: 'ARS',
  baseSign: '-',
  ...over,
})

describe('resolveMovementView — categorized family', () => {
  it('income is categorized and positive', () => {
    const v = resolveMovementView(input({ kind: 'income', baseSign: '+' }), { kind: 'global' })
    expect(v.isCategorized).toBe(true)
    expect(v.sign).toBe('+')
    expect(v.counterpartyName).toBeNull()
  })

  it('expense is categorized and negative', () => {
    const v = resolveMovementView(input({ kind: 'expense', baseSign: '-' }), { kind: 'global' })
    expect(v.isCategorized).toBe(true)
    expect(v.sign).toBe('-')
  })

  it('installment purchase is categorized', () => {
    const v = resolveMovementView(input({ kind: 'installment_purchase', baseSign: '-' }), {
      kind: 'global',
    })
    expect(v.isCategorized).toBe(true)
  })
})

describe('resolveMovementView — structure family (neutral icon)', () => {
  it('card_payment is not categorized', () => {
    const v = resolveMovementView(input({ kind: 'card_payment', baseSign: '-' }), { kind: 'global' })
    expect(v.isCategorized).toBe(false)
    expect(v.sign).toBe('-')
  })

  it('adjustment keeps its intrinsic sign and is not categorized', () => {
    const up = resolveMovementView(input({ kind: 'adjustment', baseSign: '+' }), { kind: 'global' })
    const down = resolveMovementView(input({ kind: 'adjustment', baseSign: '-' }), { kind: 'global' })
    expect(up.isCategorized).toBe(false)
    expect(up.sign).toBe('+')
    expect(down.sign).toBe('-')
  })
})

describe('resolveMovementView — transfer perspective', () => {
  const transfer = input({
    kind: 'transfer',
    accountId: 'a',
    accountName: 'A',
    destinationAccountId: 'b',
    destinationAccountName: 'B',
    baseSign: null,
  })

  it('global shows both ends, neutral sign', () => {
    const v = resolveMovementView(transfer, { kind: 'global' })
    expect(v.sign).toBeNull()
    expect(v.counterpartyName).toBe('B')
  })

  it('from the source account it is an outflow', () => {
    const v = resolveMovementView(transfer, { kind: 'account', accountId: 'a' })
    expect(v.sign).toBe('-')
    expect(v.counterpartyName).toBe('B')
    expect(v.counterpartyDirection).toBe('out')
  })

  it('from the destination account it is an inflow', () => {
    const v = resolveMovementView(transfer, { kind: 'account', accountId: 'b' })
    expect(v.sign).toBe('+')
    expect(v.counterpartyName).toBe('A')
    expect(v.counterpartyDirection).toBe('in')
    expect(v.amount).toBe(100)
  })
})

describe('resolveMovementView — exchange perspective', () => {
  const exchange = input({
    kind: 'exchange',
    accountId: 'a',
    accountName: 'Caja ARS',
    destinationAccountId: 'b',
    destinationAccountName: 'Caja USD',
    amount: 95000,
    currencyCode: 'ARS',
    destinationAmount: 100,
    destinationCurrency: 'USD',
    baseSign: '-',
  })

  it('from the source account: source leg outflow in ARS', () => {
    const v = resolveMovementView(exchange, { kind: 'account', accountId: 'a' })
    expect(v.sign).toBe('-')
    expect(v.amount).toBe(95000)
    expect(v.currencyCode).toBe('ARS')
    expect(v.counterpartyName).toBe('Caja USD')
  })

  it('from the destination account: received leg inflow in USD', () => {
    const v = resolveMovementView(exchange, { kind: 'account', accountId: 'b' })
    expect(v.sign).toBe('+')
    expect(v.amount).toBe(100)
    expect(v.currencyCode).toBe('USD')
    expect(v.counterpartyName).toBe('Caja ARS')
  })

  it('global shows the source leg with its neutral sign', () => {
    const v = resolveMovementView(exchange, { kind: 'global' })
    expect(v.sign).toBe('-')
    expect(v.amount).toBe(95000)
    expect(v.currencyCode).toBe('ARS')
  })

  it('intra-account exchange (same account both legs) is seen as the source leg', () => {
    const intra = { ...exchange, destinationAccountId: 'a', destinationAccountName: 'Caja ARS' }
    const v = resolveMovementView(intra, { kind: 'account', accountId: 'a' })
    expect(v.sign).toBe('-')
    expect(v.currencyCode).toBe('ARS')
  })
})
