import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL SALDO POR FILA DE LA APP SALE DE LAS MISMAS FUNCIONES QUE LA WEB.
 *
 * Las pantallas de React Native no se pueden montar en Node, así que se mira el
 * código: el detalle de cuenta tiene que calcular el saldo corriente con
 * `computeRunningBalances`, decidir cuántas monedas muestra con
 * `runningBalanceCurrencies` (una vez por cuenta, no por fila) y ocultarlo
 * cuando hay filtros o búsqueda. Si alguien lo recalcula a mano o deja de
 * ocultarlo, este test se cae.
 */

const ROOT = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('saldo corriente en el detalle de cuenta nativo', () => {
  const section = read('components/accounts/MovementsSection.tsx')
  const row = read('components/accounts/MovementRow.tsx')
  const screen = read('app/(app)/accounts/[id]/index.tsx')

  it('lo calcula con las funciones compartidas de @grana/money-logic', () => {
    expect(section).toMatch(/computeRunningBalances\(/)
    expect(section).toMatch(/runningBalanceCurrencies\(/)
    expect(section).toMatch(/from '@grana\/money-logic'/)
  })

  it('arranca del saldo inicial de la cuenta, que la pantalla le pasa', () => {
    expect(screen).toMatch(/currencies=\{account\.currencies\}/)
    expect(section).toMatch(/initial_balance/)
  })

  it('lo oculta con filtros activos o con búsqueda', () => {
    expect(section).toMatch(/showRunningBalance\s*=\s*activeCount === 0 && filters\.query\.trim\(\)\.length === 0/)
    expect(section).toMatch(/runningBalance=\{showRunningBalance \?/)
  })

  it('la fila muestra el saldo de cada moneda y la pata recibida del cambio', () => {
    expect(row).toMatch(/runningBalanceCurrencies\.map\(/)
    expect(row).toMatch(/view\.receivedLeg/)
  })
})
