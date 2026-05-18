import { describe, expect, it } from 'vitest'
import { normalizeMoneyAmount, parseMoneyInput } from '@grana/validation'

describe('parseMoneyInput', () => {
  it('parses dot and comma decimal separators', () => {
    expect(parseMoneyInput('123.45')).toBe(123.45)
    expect(parseMoneyInput('123,45')).toBe(123.45)
  })

  it('rejects partial parse and too many money decimals', () => {
    expect(parseMoneyInput('123abc')).toBeNull()
    expect(parseMoneyInput('123.456')).toBeNull()
  })

  it('supports fx rates with six decimal places', () => {
    expect(parseMoneyInput('1400.123456', { decimalPlaces: 6 })).toBe(1400.123456)
  })

  it('rejects negative values unless explicitly allowed', () => {
    expect(parseMoneyInput('-10')).toBeNull()
    expect(parseMoneyInput('-10', { allowNegative: true })).toBe(-10)
  })
})

describe('normalizeMoneyAmount', () => {
  it('normalizes persisted money values to two decimal places by default', () => {
    expect(normalizeMoneyAmount(10.239)).toBe(10.24)
  })

  it('normalizes fx rates to six decimal places when requested', () => {
    expect(normalizeMoneyAmount(1400.1234567, { decimalPlaces: 6 })).toBe(1400.123457)
  })

  it('rejects non-finite values', () => {
    expect(normalizeMoneyAmount(Number.NaN)).toBeNull()
    expect(normalizeMoneyAmount(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
