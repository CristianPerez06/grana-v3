import { describe, expect, it } from 'vitest'
import { Money } from '@grana/validation'
import { deriveMonthOpening } from '../src/month-opening'

describe('deriveMonthOpening', () => {
  it('backs out what was carried into the month', () => {
    // Cerró en 815.573,34 habiendo entrado 1.021.007 y salido 205.433,66:
    // arrancó el mes en cero.
    expect(deriveMonthOpening(815_573.34, { entro: 1_021_007, seFue: 205_433.66 })).toBe(0)
  })

  it('carries a negative opening when the month started in the red', () => {
    // El caso real: el saldo de agosto arrastra lo de meses anteriores.
    const venia = deriveMonthOpening(-1_954_251.83, { entro: 1_021_007, seFue: 205_433.66 })

    expect(venia).toBe(-2_769_825.17)
  })

  it('equals the closing balance when nothing moved', () => {
    expect(deriveMonthOpening(50_000, { entro: 0, seFue: 0 })).toBe(50_000)
  })

  it.each([
    ['positivo', 120_000, { entro: 80_000, seFue: 30_000 }],
    ['negativo', -1_954_251.83, { entro: 1_021_007, seFue: 205_433.66 }],
    ['sin cierre', 0, { entro: 576_088.5, seFue: 576_088.5 }],
    ['con centavos', 1_234.56, { entro: 789.01, seFue: 1_000.99 }],
    ['solo egresos', -576_088.5, { entro: 0, seFue: 576_088.5 }],
  ])('los tres montos cierran contra el saldo (%s)', (_name, closing, summary) => {
    const venia = deriveMonthOpening(closing, summary)

    // Re-added with `Money`, not raw floats: at these magnitudes plain JS
    // addition loses precision and would fail an identity the production path
    // actually holds — the app never sums these with `+`.
    const recomposed = Money.toNumber(
      Money.subtract(
        Money.add(Money.from(venia), Money.from(summary.entro)),
        Money.from(summary.seFue),
      ),
    )

    expect(recomposed).toBe(closing)
  })
})
