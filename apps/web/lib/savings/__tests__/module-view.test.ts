import { describe, expect, it } from 'vitest'
import {
  moduleAmountOf,
  moduleGroupCurrency,
  moduleGroups,
  moduleHasSavings,
  moduleRest,
  moduleRowFor,
  moduleAmountIsShown,
  moduleVisibleAmounts,
} from '@grana/savings'
import type { AvailableSums, PurposeSums } from '@grana/savings'

/**
 * Los números reales de agosto de 2026, que son con los que se hace el QA:
 * $180.000 guardados repartidos en cinco propósitos más $55.000 sin destino, y
 * US$ 10 que viven todos en Viaje.
 */
const SUMS: AvailableSums[] = [
  { currencyCode: 'ARS', accountsNet: 5_085_748.17, reserved: 180_000, available: 4_905_748.17 },
  { currencyCode: 'USD', accountsNet: 10, reserved: 10, available: 0 },
]

const p = (
  purposeId: string | null,
  purposeName: string | null,
  currencyCode: 'ARS' | 'USD',
  reserved: number,
): PurposeSums => ({
  purposeId,
  purposeName,
  purposeIcon: purposeName == null ? null : '🎯',
  currencyCode,
  reserved,
})

const ROWS: PurposeSums[] = [
  p('e', 'Emergencia', 'ARS', 50_000),
  p('v', 'Viaje', 'ARS', 45_000),
  p('v', 'Viaje', 'USD', 10),
  p('c', 'Casa', 'ARS', 20_000),
  p('s', 'Estudio', 'ARS', 5_000),
  p('a', 'Auto', 'ARS', 5_000),
  p(null, null, 'ARS', 55_000),
]

describe('la foto del módulo', () => {
  it('lee cada moneda por separado', () => {
    expect(moduleRowFor(SUMS, 'ARS').available).toBe(4_905_748.17)
    expect(moduleRowFor(SUMS, 'USD').reserved).toBe(10)
  })

  it('una moneda ausente es cero, no undefined', () => {
    const onlyArs = [SUMS[0]]
    expect(moduleRowFor(onlyArs, 'USD')).toEqual({
      currencyCode: 'USD',
      accountsNet: 0,
      reserved: 0,
      available: 0,
    })
  })

  it('detecta que hay guardado sin sumar monedas', () => {
    expect(moduleHasSavings(SUMS)).toBe(true)
    // Solo dólares: si la respuesta saliera de sumar, un ARS en cero no cambiaría
    // nada — pero el punto es que la pregunta se contesta por moneda.
    expect(moduleHasSavings([{ ...SUMS[1] }])).toBe(true)
  })

  it('sin nada guardado en ninguna moneda, no hay foto que mostrar', () => {
    expect(
      moduleHasSavings([
        { currencyCode: 'ARS', accountsNet: 500, reserved: 0, available: 500 },
        { currencyCode: 'USD', accountsNet: 0, reserved: 0, available: 0 },
      ]),
    ).toBe(false)
  })
})

describe('cuándo se muestra un monto', () => {
  it('se muestra si tiene plata', () => {
    expect(moduleAmountIsShown({ currency: 'USD', reserved: 10 })).toBe(true)
  })

  it('no se muestra en cero: «US$ 0» en cada card es ruido repetido', () => {
    expect(moduleAmountIsShown({ currency: 'USD', reserved: 0 })).toBe(false)
  })

  it('un negativo se muestra: es un hecho, no una ausencia', () => {
    expect(moduleAmountIsShown({ currency: 'ARS', reserved: -500 })).toBe(true)
  })
})

describe('el desglose por propósito', () => {
  it('ordena por lo que pesa en pesos', () => {
    expect(moduleGroups(ROWS).map((g) => g.name)).toEqual([
      'Emergencia',
      'Viaje',
      'Casa',
      'Estudio',
      'Auto',
    ])
  })

  it('desempata por dólares cuando los pesos son iguales', () => {
    const tie: PurposeSums[] = [
      p('x', 'Sin dólares', 'ARS', 5_000),
      p('y', 'Con dólares', 'ARS', 5_000),
      p('y', 'Con dólares', 'USD', 3),
    ]
    expect(moduleGroups(tie).map((g) => g.name)).toEqual(['Con dólares', 'Sin dólares'])
  })

  it('deja «Sin destino» FUERA de la lista: es el resto, no un propósito', () => {
    expect(moduleGroups(ROWS).map((g) => g.purposeId)).not.toContain(null)
    expect(moduleGroups(ROWS)).toHaveLength(5)
  })

  it('cada grupo trae las dos monedas, sin sumarlas', () => {
    const viaje = moduleGroups(ROWS).find((g) => g.name === 'Viaje')!
    expect(viaje.amounts).toEqual([
      { currency: 'ARS', reserved: 45_000 },
      { currency: 'USD', reserved: 10 },
    ])
  })

  it('un propósito sin filas en una moneda vale cero ahí', () => {
    expect(moduleAmountOf(ROWS, 'USD', 'e')).toBe(0)
  })

  it('el resto se lee como un grupo más', () => {
    expect(moduleRest(ROWS)).toEqual([
      { currency: 'ARS', reserved: 55_000 },
      { currency: 'USD', reserved: 0 },
    ])
  })

  it('los cinco propósitos más el resto dan el guardado, en cada moneda', () => {
    const groups = moduleGroups(ROWS)
    const rest = moduleRest(ROWS)
    const ars = groups.reduce((a, g) => a + g.amounts[0].reserved, 0) + rest[0].reserved
    const usd = groups.reduce((a, g) => a + g.amounts[1].reserved, 0) + rest[1].reserved
    expect(ars).toBe(moduleRowFor(SUMS, 'ARS').reserved)
    expect(usd).toBe(moduleRowFor(SUMS, 'USD').reserved)
  })
})

describe('cuántos montos muestra una fila', () => {
  it('una sola línea cuando solo hay pesos', () => {
    const casa = moduleGroups(ROWS).find((g) => g.name === 'Casa')!
    expect(moduleVisibleAmounts(casa.amounts)).toEqual([{ currency: 'ARS', reserved: 20_000 }])
  })

  it('dos líneas cuando el propósito es bimoneda', () => {
    const viaje = moduleGroups(ROWS).find((g) => g.name === 'Viaje')!
    expect(moduleVisibleAmounts(viaje.amounts)).toHaveLength(2)
  })

  it('con todo en cero muestra los pesos, no una fila vacía', () => {
    expect(
      moduleVisibleAmounts([
        { currency: 'ARS', reserved: 0 },
        { currency: 'USD', reserved: 0 },
      ]),
    ).toEqual([{ currency: 'ARS', reserved: 0 }])
  })
})

describe('en qué moneda entra una fila', () => {
  it('en pesos cuando tiene pesos, aunque también tenga dólares', () => {
    const viaje = moduleGroups(ROWS).find((g) => g.name === 'Viaje')!
    expect(moduleGroupCurrency(viaje.amounts)).toBe('ARS')
  })

  it('en dólares cuando es lo único que tiene', () => {
    expect(
      moduleGroupCurrency([
        { currency: 'ARS', reserved: 0 },
        { currency: 'USD', reserved: 10 },
      ]),
    ).toBe('USD')
  })

  it('en pesos cuando no tiene nada: no hay moneda que el dato indique', () => {
    expect(
      moduleGroupCurrency([
        { currency: 'ARS', reserved: 0 },
        { currency: 'USD', reserved: 0 },
      ]),
    ).toBe('ARS')
  })

  it('el resto de agosto abre en pesos, que es donde está', () => {
    expect(moduleGroupCurrency(moduleRest(ROWS))).toBe('ARS')
  })
})
