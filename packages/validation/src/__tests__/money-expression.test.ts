import { describe, expect, it } from 'vitest'
import { evaluateMoneyExpression } from '../money'

describe('evaluateMoneyExpression', () => {
  it('adds and multiplies with standard precedence', () => {
    expect(evaluateMoneyExpression('1200+350*2')).toBe(1900)
  })

  it('subtracts and divides', () => {
    expect(evaluateMoneyExpression('1000-250')).toBe(750)
    expect(evaluateMoneyExpression('1000/4')).toBe(250)
  })

  it('honours parentheses', () => {
    expect(evaluateMoneyExpression('(1000,50 + 0,50) / 2')).toBe(500.5)
    expect(evaluateMoneyExpression('(2+3)*4')).toBe(20)
  })

  it('accepts both es-AR (,) and dot decimals inside an expression', () => {
    expect(evaluateMoneyExpression('1000,25 + 0,25')).toBe(1000.5)
    expect(evaluateMoneyExpression('1000.25 + 0.25')).toBe(1000.5)
  })

  it('accepts × and ÷ glyphs as well as * and /', () => {
    expect(evaluateMoneyExpression('12×3')).toBe(36)
    expect(evaluateMoneyExpression('12÷4')).toBe(3)
  })

  it('rounds the result to two decimals', () => {
    expect(evaluateMoneyExpression('10/3')).toBe(3.33)
    expect(evaluateMoneyExpression('0,1+0,2')).toBe(0.3)
  })

  it('handles unary minus and whitespace', () => {
    expect(evaluateMoneyExpression('  -5 + 10 ')).toBe(5)
    expect(evaluateMoneyExpression('10 * -2')).toBe(-20)
    expect(evaluateMoneyExpression('-(3+2)')).toBe(-5)
  })

  it('resolves a single plain number', () => {
    expect(evaluateMoneyExpression('1550')).toBe(1550)
    expect(evaluateMoneyExpression('1550,50')).toBe(1550.5)
  })

  it('returns null for empty or whitespace-only input', () => {
    expect(evaluateMoneyExpression('')).toBeNull()
    expect(evaluateMoneyExpression('   ')).toBeNull()
  })

  it('returns null for a malformed expression', () => {
    expect(evaluateMoneyExpression('1200+')).toBeNull()
    expect(evaluateMoneyExpression('+')).toBeNull()
    expect(evaluateMoneyExpression('(1+2')).toBeNull()
    expect(evaluateMoneyExpression('1++2')).toBe(3) // unary plus is valid
    expect(evaluateMoneyExpression('2 3')).toBeNull()
    expect(evaluateMoneyExpression('1.2.3')).toBeNull()
    expect(evaluateMoneyExpression('abc')).toBeNull()
  })

  it('returns null on division by zero', () => {
    expect(evaluateMoneyExpression('5/0')).toBeNull()
    expect(evaluateMoneyExpression('5/(2-2)')).toBeNull()
  })
})
