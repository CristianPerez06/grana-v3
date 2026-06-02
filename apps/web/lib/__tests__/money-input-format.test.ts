import { describe, expect, it } from 'vitest'
import { formatGrouped, formatForDisplay, toCanonical } from '../money-input-format'
import { parseMoneyInput } from '@grana/validation'

describe('toCanonical', () => {
  it('returns empty for empty/garbage input', () => {
    expect(toCanonical('')).toBe('')
    expect(toCanonical('abc')).toBe('')
  })

  it('drops grouping dots (a dot is never a decimal)', () => {
    expect(toCanonical('1.000')).toBe('1000')
    expect(toCanonical('1.234.567')).toBe('1234567')
    expect(toCanonical('1.0000')).toBe('10000')
  })

  it('treats the first comma as the decimal separator', () => {
    expect(toCanonical('1.000,50')).toBe('1000.50')
    expect(toCanonical('1.234,5')).toBe('1234.5')
  })

  it('keeps a just-typed trailing comma so cents can follow', () => {
    expect(toCanonical('1.000,')).toBe('1000.')
  })

  it('trims leading zeros so typing onto a default "0" works', () => {
    expect(toCanonical('01')).toBe('1')
    expect(toCanonical('010000')).toBe('10000')
    expect(toCanonical('0')).toBe('0')
    expect(toCanonical('00')).toBe('0')
    expect(toCanonical('0,5')).toBe('0.5')
  })

  it('caps the fractional part to 2 digits', () => {
    expect(toCanonical('1000,555')).toBe('1000.55')
  })
})

describe('formatGrouped', () => {
  it('returns empty for empty input', () => {
    expect(formatGrouped('')).toBe('')
  })

  it('groups the integer part with dots', () => {
    expect(formatGrouped('1000')).toBe('1.000')
    expect(formatGrouped('10000')).toBe('10.000')
    expect(formatGrouped('1234567')).toBe('1.234.567')
    expect(formatGrouped('999')).toBe('999')
  })

  it('shows the decimal separator as a comma', () => {
    expect(formatGrouped('1000.50')).toBe('1.000,50')
    expect(formatGrouped('1234.5')).toBe('1.234,5')
  })

  it('preserves a trailing decimal separator', () => {
    expect(formatGrouped('1000.')).toBe('1.000,')
  })
})

// The reported bug: typing "1" then four zeros must become "10.000" (ten
// thousand), never "100,00". Each keystroke appends to the end of the grouped
// display (the caret jumps to the end on reformat), so we simulate that loop.
describe('typing a large amount never invents a decimal', () => {
  it('1 followed by zeros stays an integer', () => {
    let display = '0' // create-account USD field default
    for (const key of ['1', '0', '0', '0', '0']) {
      const canonical = toCanonical(display + key)
      display = formatForDisplay(canonical)
    }
    expect(display).toBe('10.000')
    expect(parseMoneyInput(toCanonical(display))).toBe(10000)
  })

  it('reaches 1000 with 1 and three zeros', () => {
    let display = '0'
    for (const key of ['1', '0', '0', '0']) {
      display = formatForDisplay(toCanonical(display + key))
    }
    expect(display).toBe('1.000')
    expect(parseMoneyInput(toCanonical(display))).toBe(1000)
  })
})

describe('formatForDisplay (prefills are canonical, dot-decimal)', () => {
  it('groups a String(number) prefill', () => {
    expect(formatForDisplay('1500.5')).toBe('1.500,5')
    expect(formatForDisplay('450000')).toBe('450.000')
    expect(formatForDisplay('1000')).toBe('1.000')
  })
})

describe('canonical output stays parseMoneyInput-valid', () => {
  it('parses grouped-then-canonicalized amounts to the right number', () => {
    expect(parseMoneyInput(toCanonical('125.000,50'))).toBe(125000.5)
    expect(parseMoneyInput(toCanonical('1.234.567'))).toBe(1234567)
    expect(parseMoneyInput(toCanonical('1.000'))).toBe(1000)
  })
})
