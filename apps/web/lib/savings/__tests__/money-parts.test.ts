import { describe, expect, it } from 'vitest'
import { money, moneyParts } from '@/app/(app)/savings/_components/money'

/**
 * `moneyParts` parte lo que devuelve `Intl`, no arma el número a mano. Estos
 * tests fijan esa promesa: si algún día el símbolo, el separador de miles o el
 * espacio cambian, el corte tiene que seguir cayendo en el mismo lugar — y si
 * no, que falle acá y no en la card del total, donde el síntoma sería un
 * «$» perdido en el medio de la cifra.
 */
describe('partir un monto en símbolo y dígitos', () => {
  it('recompone exactamente lo que formatea `money`', () => {
    for (const [amount, currency] of [
      [1_150_000, 'ARS'],
      [900, 'USD'],
      [0, 'ARS'],
      [0, 'USD'],
      [1234.56, 'ARS'],
      [10, 'USD'],
    ] as const) {
      const { symbol, digits } = moneyParts(amount, currency)
      expect(`${symbol} ${digits}`.replace(/\s+/g, ' ')).toBe(
        money(amount, currency).replace(/\s+/g, ' '),
      )
    }
  })

  it('el símbolo de pesos sale solo, sin dígitos pegados', () => {
    const { symbol, digits } = moneyParts(1_150_000, 'ARS')
    expect(symbol).toBe('$')
    expect(digits.startsWith('1')).toBe(true)
  })

  it('distingue dólares de pesos: es lo ÚNICO que separa las dos columnas', () => {
    expect(moneyParts(900, 'USD').symbol).not.toBe(moneyParts(900, 'ARS').symbol)
    expect(moneyParts(900, 'USD').symbol).toContain('US$')
  })

  it('en cero el símbolo sigue estando: el par de monedas es fijo en la card', () => {
    expect(moneyParts(0, 'USD').symbol).toContain('US$')
    expect(moneyParts(0, 'ARS').symbol).toBe('$')
  })

  it('un negativo deja el signo del lado del símbolo, no de la cifra', () => {
    const { symbol, digits } = moneyParts(-5_000, 'ARS')
    expect(symbol).toContain('-')
    expect(digits.startsWith('5')).toBe(true)
  })

  it('nunca corta en el medio de la cifra: los dígitos no traen letras ni símbolo', () => {
    for (const c of ['ARS', 'USD'] as const) {
      expect(moneyParts(1_234_567.89, c).digits).not.toMatch(/[A-Za-z$]/)
    }
  })
})
