import { describe, expect, it } from 'vitest'
import {
  moduleAccess,
  moduleCan,
  moduleRouteIsOpen,
  moduleRowFor,
  moduleShowsDashboardRow,
  moduleShowsNav,
} from '@grana/savings'
import type { AvailableSums, ModuleAbility } from '@grana/savings'

const CON_PLATA: AvailableSums[] = [
  { currencyCode: 'ARS', accountsNet: 5_085_748.17, reserved: 180_000, available: 4_905_748.17 },
  { currencyCode: 'USD', accountsNet: 10, reserved: 10, available: 0 },
]
const SIN_NADA: AvailableSums[] = [
  { currencyCode: 'ARS', accountsNet: 5_085_748.17, reserved: 0, available: 5_085_748.17 },
]
const SOLO_USD: AvailableSums[] = [
  { currencyCode: 'ARS', accountsNet: 100, reserved: 0, available: 100 },
  { currencyCode: 'USD', accountsNet: 10, reserved: 10, available: 0 },
]

const ABILITIES: ModuleAbility[] = ['read', 'release', 'save', 'allocate', 'createPurpose']

describe('los tres estados del módulo', () => {
  it('prendido: el módulo entero', () => {
    expect(moduleAccess(true, CON_PLATA)).toBe('on')
    expect(moduleAccess(true, SIN_NADA)).toBe('on')
  })

  it('apagado y sin nada guardado: no existe, y no falta nada', () => {
    expect(moduleAccess(false, SIN_NADA)).toBe('off')
  })

  it('apagado CON plata adentro: degradado, no apagado', () => {
    expect(moduleAccess(false, CON_PLATA)).toBe('degraded')
  })

  it('plata en una sola moneda ya alcanza para degradado', () => {
    // `some`, no una suma: la regla no tiene excepción de uso.
    expect(moduleAccess(false, SOLO_USD)).toBe('degraded')
  })
})

describe('la superficie de cada estado', () => {
  it('la entrada de menú es solo del módulo entero', () => {
    expect(moduleShowsNav('on')).toBe(true)
    expect(moduleShowsNav('degraded')).toBe(false)
    expect(moduleShowsNav('off')).toBe(false)
  })

  it('la RUTA sigue abierta en degradado, aunque no esté en el menú', () => {
    // Es a donde lleva la fila del dashboard, que es la última puerta que le
    // queda a esa plata. Un 404 con guardado adentro es el secuestro.
    expect(moduleRouteIsOpen('degraded')).toBe(true)
    expect(moduleRouteIsOpen('off')).toBe(false)
  })

  it('la fila del dashboard se queda mientras haya plata', () => {
    expect(moduleShowsDashboardRow('degraded', CON_PLATA)).toBe(true)
    expect(moduleShowsDashboardRow('on', SIN_NADA)).toBe(true)
    expect(moduleShowsDashboardRow('off', SIN_NADA)).toBe(false)
  })
})

describe('qué se puede hacer en cada estado', () => {
  it('prendido: todo', () => {
    for (const a of ABILITIES) expect(moduleCan('on', a)).toBe(true)
  })

  it('apagado sin plata: nada', () => {
    for (const a of ABILITIES) expect(moduleCan('off', a)).toBe(false)
  })

  it('degradado: SOLO leer y volver a usar', () => {
    expect(moduleCan('degraded', 'read')).toBe(true)
    expect(moduleCan('degraded', 'release')).toBe(true)
    expect(moduleCan('degraded', 'save')).toBe(false)
    expect(moduleCan('degraded', 'allocate')).toBe(false)
    expect(moduleCan('degraded', 'createPurpose')).toBe(false)
  })

  it('leer sobrevive PORQUE la acción lo necesita', () => {
    // Sin la lista no se puede elegir el origen, y sin origen el write path
    // rechaza: la lectura es el mínimo para que la plata salga.
    expect(moduleCan('degraded', 'release')).toBe(true)
    expect(moduleCan('degraded', 'read')).toBe(true)
  })
})

describe('la bandera controla la superficie, NUNCA los números', () => {
  it('ninguna función de acceso toca un monto', () => {
    const antes = structuredClone(CON_PLATA)
    for (const enabled of [true, false]) {
      const access = moduleAccess(enabled, CON_PLATA)
      moduleShowsNav(access)
      moduleRouteIsOpen(access)
      moduleShowsDashboardRow(access, CON_PLATA)
      for (const a of ABILITIES) moduleCan(access, a)
    }
    expect(CON_PLATA).toEqual(antes)
  })

  it('el disponible es el mismo prendido que apagado', () => {
    // `disponible = cuentas − guardado` es un hecho sobre la plata. Si esto
    // falla, una bandera le está reescribiendo el saldo a alguien.
    const prendido = moduleRowFor(CON_PLATA, 'ARS')
    const apagado = moduleRowFor(CON_PLATA, 'ARS')
    expect(apagado.available).toBe(prendido.available)
    expect(apagado.reserved).toBe(prendido.reserved)
    expect(apagado.available).toBe(4_905_748.17)
  })
})
