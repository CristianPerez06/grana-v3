import { describe, expect, it } from 'vitest'
import { runningBalanceCurrencies, type RunningBalanceRow } from '../src/balance'
import { legInCurrency, resolveMovementView, type MovementViewInput } from '../src/movements'

const ACC = 'acc-1'
const OTHER = 'acc-2'
const ZERO = { ARS: 0, USD: 0 }
const BOTH = ['ARS', 'USD'] as const

const row = (over: Partial<RunningBalanceRow>): RunningBalanceRow => ({
  id: 'tx',
  account_id: ACC,
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  amount: 100,
  type: 'expense',
  ...over,
})

describe('runningBalanceCurrencies', () => {
  it('only ARS movements → ARS only', () => {
    expect(runningBalanceCurrencies([row({})], ACC, ZERO, BOTH)).toEqual(['ARS'])
  })

  it('only USD movements → USD only', () => {
    expect(runningBalanceCurrencies([row({ currency_code: 'USD' })], ACC, ZERO, BOTH)).toEqual(['USD'])
  })

  it('movements in both currencies → both, ARS first', () => {
    const rows = [row({ currency_code: 'USD' }), row({ currency_code: 'ARS' })]
    expect(runningBalanceCurrencies(rows, ACC, ZERO, BOTH)).toEqual(['ARS', 'USD'])
  })

  it('a non-zero initial balance counts as used', () => {
    expect(runningBalanceCurrencies([row({})], ACC, { ARS: 0, USD: 50 }, BOTH)).toEqual(['ARS', 'USD'])
  })

  it('the received leg of a same-account exchange counts as used', () => {
    const rows = [
      row({
        type: 'exchange',
        transfer_destination_account_id: ACC,
        destination_currency: 'USD',
        destination_amount: 2,
      }),
    ]
    expect(runningBalanceCurrencies(rows, ACC, ZERO, BOTH)).toEqual(['ARS', 'USD'])
  })

  it('an exchange into another account does not add its currency here', () => {
    const rows = [
      row({
        type: 'exchange',
        transfer_destination_account_id: OTHER,
        destination_currency: 'USD',
        destination_amount: 2,
      }),
    ]
    expect(runningBalanceCurrencies(rows, ACC, ZERO, BOTH)).toEqual(['ARS'])
  })

  it('an incoming USD transfer counts as used', () => {
    const rows = [
      row({}),
      row({ account_id: OTHER, transfer_destination_account_id: ACC, currency_code: 'USD', type: 'transfer' }),
    ]
    expect(runningBalanceCurrencies(rows, ACC, ZERO, BOTH)).toEqual(['ARS', 'USD'])
  })

  it('a pending reimbursement does not count as used', () => {
    const rows = [
      row({}),
      row({ type: 'reimbursement', currency_code: 'USD', reimbursement_target: 'account', received_at: null }),
    ]
    expect(runningBalanceCurrencies(rows, ACC, ZERO, BOTH)).toEqual(['ARS'])
  })

  it('no usage at all falls back to the configured currencies, in order', () => {
    expect(runningBalanceCurrencies([], ACC, ZERO, ['USD', 'ARS'])).toEqual(['ARS', 'USD'])
    expect(runningBalanceCurrencies([], ACC, ZERO, ['USD'])).toEqual(['USD'])
  })
})

describe('resolveMovementView — receivedLeg', () => {
  const exchange = (over: Partial<MovementViewInput> = {}): MovementViewInput => ({
    kind: 'exchange',
    accountId: ACC,
    accountName: 'Santander',
    destinationAccountId: ACC,
    destinationAccountName: 'Santander',
    amount: 3_859_133.55,
    currencyCode: 'ARS',
    destinationAmount: 2650,
    destinationCurrency: 'USD',
    baseSign: '-',
    ...over,
  })

  it('a same-account exchange carries both legs from the account perspective', () => {
    const view = resolveMovementView(exchange(), { kind: 'account', accountId: ACC })
    expect(view.sign).toBe('-')
    expect(view.amount).toBe(3_859_133.55)
    expect(view.currencyCode).toBe('ARS')
    expect(view.receivedLeg).toEqual({ amount: 2650, currencyCode: 'USD' })
  })

  it('an exchange between two accounts shows one leg on each side', () => {
    const input = exchange({ destinationAccountId: OTHER, destinationAccountName: 'Lemon' })
    expect(resolveMovementView(input, { kind: 'account', accountId: ACC }).receivedLeg).toBeUndefined()
    const dest = resolveMovementView(input, { kind: 'account', accountId: OTHER })
    expect(dest.receivedLeg).toBeUndefined()
    expect(dest).toMatchObject({ sign: '+', amount: 2650, currencyCode: 'USD' })
  })

  it('a same-account transfer has no received leg', () => {
    const input = exchange({ kind: 'transfer', destinationAmount: null, destinationCurrency: null, baseSign: null })
    expect(resolveMovementView(input, { kind: 'account', accountId: ACC }).receivedLeg).toBeUndefined()
  })

  it('the global perspective has no received leg', () => {
    expect(resolveMovementView(exchange(), { kind: 'global' }).receivedLeg).toBeUndefined()
  })
})

describe('legInCurrency', () => {
  const base: MovementViewInput = {
    kind: 'exchange',
    accountId: ACC,
    accountName: 'Santander',
    destinationAccountId: ACC,
    destinationAccountName: 'Santander',
    amount: 3_859_133.55,
    currencyCode: 'ARS',
    destinationAmount: 2482,
    destinationCurrency: 'USD',
    baseSign: '-',
  }
  const account = { kind: 'account', accountId: ACC } as const

  it('a same-account exchange shows its outgoing leg in ARS and its incoming leg in USD', () => {
    const view = resolveMovementView(base, account)
    expect(legInCurrency(view, 'ARS')).toEqual({ sign: '-', amount: 3_859_133.55, currencyCode: 'ARS' })
    expect(legInCurrency(view, 'USD')).toEqual({ sign: '+', amount: 2482, currencyCode: 'USD' })
  })

  it('an ARS expense has no USD leg', () => {
    const view = resolveMovementView(
      { ...base, kind: 'expense', destinationAccountId: null, destinationAccountName: null, destinationAmount: null, destinationCurrency: null },
      account,
    )
    expect(legInCurrency(view, 'USD')).toBeNull()
    expect(legInCurrency(view, 'ARS')).toMatchObject({ sign: '-', amount: 3_859_133.55 })
  })

  it('an exchange into this account from another one shows only in the destination currency', () => {
    const view = resolveMovementView({ ...base, accountId: OTHER }, account)
    expect(legInCurrency(view, 'ARS')).toBeNull()
    expect(legInCurrency(view, 'USD')).toEqual({ sign: '+', amount: 2482, currencyCode: 'USD' })
  })
})
