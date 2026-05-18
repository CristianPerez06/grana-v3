import { describe, it, expect } from 'vitest'
import { splitAmountIntoInstallments } from '../utils'
import { Money } from '@grana/validation'

// ── 12.7: splitAmountIntoInstallments — residue-to-first ─────────────────────

describe('splitAmountIntoInstallments', () => {
  it('splits $1000 into 3 parts: 333.34 + 333.33 + 333.33 (residue to first)', () => {
    const result = splitAmountIntoInstallments(1000, 3)
    expect(result).toHaveLength(3)
    expect(Money.toNumber(result[0])).toBe(333.34)
    expect(Money.toNumber(result[1])).toBe(333.33)
    expect(Money.toNumber(result[2])).toBe(333.33)
  })

  it('splits $100 into 3 parts with residue to first', () => {
    const result = splitAmountIntoInstallments(100, 3)
    expect(result).toHaveLength(3)
    // First installment >= last
    expect(Money.toNumber(result[0])).toBeGreaterThanOrEqual(Money.toNumber(result[1]))
  })

  it('splits evenly when divisible', () => {
    const result = splitAmountIntoInstallments(300, 3)
    expect(result).toHaveLength(3)
    expect(result.every((m) => Money.toNumber(m) === 100)).toBe(true)
  })

  it('sums back to the original amount with no penny loss', () => {
    const cases: [number, number][] = [
      [999.99, 2],
      [1234.56, 3],
      [500, 6],
      [0.03, 3],
    ]

    for (const [amount, n] of cases) {
      const parts = splitAmountIntoInstallments(amount, n)
      const total = parts.reduce((acc, m) => acc + Money.toNumber(m), 0)
      expect(Math.round(total * 100)).toBe(Math.round(amount * 100))
    }
  })

  it('handles single installment (N=1)', () => {
    const result = splitAmountIntoInstallments(500, 1)
    expect(result).toHaveLength(1)
    expect(Money.toNumber(result[0])).toBe(500)
  })
})
