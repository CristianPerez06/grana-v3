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

// evaluateMoneyExpression — resolve a small arithmetic expression to a money
// amount, using decimal.js so results carry the same precision as the rest of
// the money layer. Powers the "type a sum in the amount field" affordance
// (e.g. "1200+350*2") and the calculator keypad.
//
// Grammar (recursive descent, standard precedence):
//   expr   := term (('+' | '-') term)*
//   term   := factor (('×'|'*'|'÷'|'/') factor)*
//   factor := ('-' | '+')? primary
//   primary:= number | '(' expr ')'
//
// It NEVER uses eval()/Function. Separators inside a number are DECIMAL here
// (both `,` and `.`), and a number may carry at most ONE — so inside an
// expression "1.000" reads as 1.0, not 1000. That differs from a plain grouped
// amount, which is why the input only routes text through this evaluator once it
// contains an operator (a bare number keeps its es-AR grouping path). Returns
// the result rounded to 2 decimals, or null for empty/malformed input or a
// division by zero.

type Token =
  | { kind: 'num'; value: Decimal }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }

// Sentinel thrown by the parser to unwind to the top-level try/catch as `null`.
const EXPR_ERROR = Symbol('money-expression-error')

function tokenizeMoneyExpression(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t') {
      i += 1
      continue
    }
    if (ch === '+' || ch === '-') {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ kind: 'op', value: '*' })
      i += 1
      continue
    }
    if (ch === '/' || ch === '÷') {
      tokens.push({ kind: 'op', value: '/' })
      i += 1
      continue
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' })
      i += 1
      continue
    }
    // Number literal: a run of digits and separators. At most one separator,
    // treated as the decimal point.
    if (/[\d.,]/.test(ch)) {
      let raw = ''
      while (i < input.length && /[\d.,]/.test(input[i])) {
        raw += input[i]
        i += 1
      }
      const normalized = raw.replace(/,/g, '.')
      // Reject empty, a lone separator, or more than one separator.
      if (!/^\d*\.?\d+$|^\d+\.?\d*$/.test(normalized) || (normalized.match(/\./g)?.length ?? 0) > 1) {
        throw EXPR_ERROR
      }
      tokens.push({ kind: 'num', value: new Decimal(normalized) })
      continue
    }
    throw EXPR_ERROR
  }
  return tokens
}

export function evaluateMoneyExpression(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  try {
    const tokens = tokenizeMoneyExpression(trimmed)
    if (tokens.length === 0) throw EXPR_ERROR

    let pos = 0
    const peek = (): Token | undefined => tokens[pos]

    const parseExpr = (): Decimal => {
      let acc = parseTerm()
      for (;;) {
        const t = peek()
        if (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
          pos += 1
          const rhs = parseTerm()
          acc = t.value === '+' ? acc.plus(rhs) : acc.minus(rhs)
        } else {
          return acc
        }
      }
    }

    const parseTerm = (): Decimal => {
      let acc = parseFactor()
      for (;;) {
        const t = peek()
        if (t?.kind === 'op' && (t.value === '*' || t.value === '/')) {
          pos += 1
          const rhs = parseFactor()
          if (t.value === '/') {
            if (rhs.isZero()) throw EXPR_ERROR
            acc = acc.dividedBy(rhs)
          } else {
            acc = acc.times(rhs)
          }
        } else {
          return acc
        }
      }
    }

    const parseFactor = (): Decimal => {
      const t = peek()
      if (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
        pos += 1
        const operand = parseFactor()
        return t.value === '-' ? operand.negated() : operand
      }
      return parsePrimary()
    }

    const parsePrimary = (): Decimal => {
      const t = peek()
      if (t?.kind === 'num') {
        pos += 1
        return t.value
      }
      if (t?.kind === 'lparen') {
        pos += 1
        const inner = parseExpr()
        if (peek()?.kind !== 'rparen') throw EXPR_ERROR
        pos += 1
        return inner
      }
      throw EXPR_ERROR
    }

    const result = parseExpr()
    if (pos !== tokens.length) throw EXPR_ERROR // trailing garbage
    if (!result.isFinite()) return null
    return result.toDecimalPlaces(2).toNumber()
  } catch {
    return null
  }
}
