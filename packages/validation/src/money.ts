import Decimal from 'decimal.js'

const _brand = Symbol('Money')

export type Money = {
  readonly [_brand]: true
  readonly _d: Decimal
}

type ParseMoneyInputOptions = {
  decimalPlaces?: number
  allowNegative?: boolean
}

type NormalizeMoneyAmountOptions = {
  decimalPlaces?: number
}

function wrap(d: Decimal): Money {
  return { [_brand]: true as const, _d: d } as Money
}

export const Money = {
  from(value: number | string): Money {
    return wrap(new Decimal(value))
  },

  add(a: Money, b: Money): Money {
    return wrap(a._d.plus(b._d))
  },

  subtract(a: Money, b: Money): Money {
    return wrap(a._d.minus(b._d))
  },

  multiply(a: Money, factor: number | string): Money {
    return wrap(a._d.times(factor).toDecimalPlaces(2))
  },

  divide(a: Money, divisor: number | string): Money {
    return wrap(a._d.dividedBy(divisor).toDecimalPlaces(2))
  },

  // Split into n equal parts distributing the rounding residue to the first part,
  // so that parts always sum exactly to the original amount.
  split(a: Money, n: number): Money[] {
    if (n <= 0 || !Number.isInteger(n)) throw new Error('n must be a positive integer')
    const base = a._d.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN)
    const residue = a._d.minus(base.times(n))
    return Array.from({ length: n }, (_, i) =>
      wrap(i === 0 ? base.plus(residue) : base),
    )
  },

  toNumber(m: Money): number {
    return m._d.toNumber()
  },

  toFixed(m: Money, dp = 2): string {
    return m._d.toFixed(dp)
  },

  isZero(m: Money): boolean {
    return m._d.isZero()
  },

  isNegative(m: Money): boolean {
    return m._d.isNegative()
  },

  compare(a: Money, b: Money): -1 | 0 | 1 {
    const c = a._d.comparedTo(b._d)
    return c < 0 ? -1 : c > 0 ? 1 : 0
  },
}

export function parseMoneyInput(
  value: string,
  options: ParseMoneyInputOptions = {},
): number | null {
  const decimalPlaces = options.decimalPlaces ?? 2
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(',', '.')
  const sign = options.allowNegative ? '-?' : ''
  const pattern = new RegExp(`^${sign}(?:\\d+|\\d*\\.\\d{1,${decimalPlaces}})$`)
  if (!pattern.test(normalized)) return null

  try {
    return Money.toNumber(Money.from(normalized))
  } catch {
    return null
  }
}

export function normalizeMoneyAmount(
  value: number | string,
  options: NormalizeMoneyAmountOptions = {},
): number | null {
  const decimalPlaces = options.decimalPlaces ?? 2

  try {
    const decimal = new Decimal(value)
    if (!decimal.isFinite()) return null
    return decimal.toDecimalPlaces(decimalPlaces).toNumber()
  } catch {
    return null
  }
}
