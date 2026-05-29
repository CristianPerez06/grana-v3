import { describe, expect, it } from 'vitest'
import {
  fmtAmountParts,
  resolveTone,
  toneToClass,
  type Tone,
} from '@/lib/transactions/components/tone'

describe('resolveTone', () => {
  it('income kind is income', () => {
    expect(resolveTone('income', '+', false)).toBe('income')
  })

  it('expense kind is expense', () => {
    expect(resolveTone('expense', '-', false)).toBe('expense')
  })

  it('card_payment is expense (it spends the user disponible)', () => {
    expect(resolveTone('card_payment', '-', false)).toBe('expense')
  })

  it('installment_purchase (parent) is expense', () => {
    expect(resolveTone('installment_purchase', '-', false)).toBe('expense')
  })

  it('transfer is neutral', () => {
    expect(resolveTone('transfer', '-', false)).toBe('neutral')
    expect(resolveTone('transfer', '+', false)).toBe('neutral')
  })

  it('exchange is neutral', () => {
    expect(resolveTone('exchange', '-', false)).toBe('neutral')
    expect(resolveTone('exchange', '+', false)).toBe('neutral')
  })

  it('adjustment positive is income, negative is expense', () => {
    expect(resolveTone('adjustment', '+', false)).toBe('income')
    expect(resolveTone('adjustment', '-', false)).toBe('expense')
  })

  it('reimbursement received is income', () => {
    expect(resolveTone('reimbursement', '+', false)).toBe('income')
  })

  it('reimbursement pending is pending (overrides kind)', () => {
    expect(resolveTone('reimbursement', '+', true)).toBe('pending')
  })

  it('pending flag wins over any kind', () => {
    // Defensive: if a caller mistakenly flags non-reimbursement as pending,
    // we still surface `pending` to make the tone explicit.
    expect(resolveTone('expense', '-', true)).toBe('pending')
  })
})

describe('toneToClass', () => {
  const cases: Array<[Tone, string]> = [
    ['income', 'text-income'],
    ['expense', 'text-expense'],
    ['neutral', 'text-neutral-amount'],
    ['pending', 'text-pending'],
  ]
  it.each(cases)('%s → %s', (tone, expected) => {
    expect(toneToClass(tone)).toBe(expected)
  })
})

describe('fmtAmountParts', () => {
  it('ARS sin centavos exactos suprime los decimales cuando showCents=false', () => {
    const parts = fmtAmountParts(540000, 'ARS', 'expense', false)
    expect(parts).toEqual({ symbol: '$', sign: '−', int: '540.000', dec: '' })
  })

  it('ARS con centavos siempre muestra los decimales cuando showCents=true', () => {
    const parts = fmtAmountParts(540000, 'ARS', 'expense', true)
    expect(parts.dec).toBe('00')
  })

  it('ARS con decimales no enteros siempre muestra los decimales (aun showCents=false)', () => {
    const parts = fmtAmountParts(1234.56, 'ARS', 'expense', false)
    expect(parts).toEqual({ symbol: '$', sign: '−', int: '1.234', dec: '56' })
  })

  it('USD usa US$ como símbolo', () => {
    const parts = fmtAmountParts(200, 'USD', 'neutral', true)
    expect(parts.symbol).toBe('US$')
    expect(parts.sign).toBe('')
  })

  it('income tone usa signo +', () => {
    const parts = fmtAmountParts(1000, 'ARS', 'income', false)
    expect(parts.sign).toBe('+')
  })

  it('neutral y pending no llevan signo', () => {
    expect(fmtAmountParts(100, 'ARS', 'neutral', true).sign).toBe('')
    expect(fmtAmountParts(100, 'ARS', 'pending', true).sign).toBe('')
  })

  it('amount 0 se formatea como 0', () => {
    const parts = fmtAmountParts(0, 'ARS', 'neutral', false)
    expect(parts.int).toBe('0')
    expect(parts.dec).toBe('')
  })

  it('valor negativo se trata como absoluto (el signo lo da el tone)', () => {
    const parts = fmtAmountParts(-1500, 'ARS', 'expense', false)
    expect(parts.int).toBe('1.500')
    expect(parts.sign).toBe('−')
  })

  it('monto grande con separadores de miles', () => {
    const parts = fmtAmountParts(1234567, 'ARS', 'expense', false)
    expect(parts.int).toBe('1.234.567')
  })
})
