import { describe, expect, it } from 'vitest'
import { checkNegativeBalance } from '../negative-balance-warning'

describe('checkNegativeBalance', () => {
  it('warns when the outflow exceeds the available balance', () => {
    const result = checkNegativeBalance(8000, 10000)
    expect(result.negative).toBe(true)
    expect(result.projected).toBe(-2000)
  })

  it('does not warn when the outflow fits within the available balance', () => {
    const result = checkNegativeBalance(50000, 10000)
    expect(result.negative).toBe(false)
    expect(result.projected).toBe(40000)
  })

  it('does not warn when the outflow exactly empties the account (0 is not negative)', () => {
    const result = checkNegativeBalance(10000, 10000)
    expect(result.negative).toBe(false)
    expect(result.projected).toBe(0)
  })

  it('warns when the account is already negative and the outflow deepens it', () => {
    const result = checkNegativeBalance(-500, 100)
    expect(result.negative).toBe(true)
    expect(result.projected).toBe(-600)
  })

  it('does not warn for a non-positive outflow (e.g. income or an upward adjustment)', () => {
    expect(checkNegativeBalance(100, 0).negative).toBe(false)
    expect(checkNegativeBalance(100, -50).negative).toBe(false)
  })

  it('uses decimal-safe arithmetic (no float drift)', () => {
    // 0.30 - 0.30 must be exactly 0, never -1e-17 → would falsely warn.
    const result = checkNegativeBalance(0.3, 0.3)
    expect(result.negative).toBe(false)
    expect(result.projected).toBe(0)
  })

  it('warns on a sub-cent overdraft with decimal precision', () => {
    const result = checkNegativeBalance(0.1, 0.2)
    expect(result.negative).toBe(true)
    expect(result.projected).toBeCloseTo(-0.1, 10)
  })
})
