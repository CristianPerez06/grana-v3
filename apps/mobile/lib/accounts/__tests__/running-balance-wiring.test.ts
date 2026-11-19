import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL DETALLE DE CUENTA NATIVO SE ARMA CON LAS MISMAS PIEZAS QUE LA WEB.
 *
 * Las pantallas de React Native no se pueden montar en Node, así que se mira el
 * código: el saldo corriente sale de `computeRunningBalances`, cuántas monedas
 * usa la cuenta de `runningBalanceCurrencies`, la parte de un movimiento en una
 * moneda de `legInCurrency`, y las filas son la `MovementList` compartida con la
 * pestaña Movimientos —no una fila propia, que ya divergió una vez y mostraba
 * «12 nov» o «CU» como título—. Si alguien lo recalcula a mano o vuelve a una
 * fila propia, este test se cae.
 */

const ROOT = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('detalle de cuenta nativo', () => {
  const section = read('components/accounts/MovementsSection.tsx')
  const row = read('components/movements/MovementRow.tsx')
  const filters = read('lib/accounts/movement-filters.ts')
  const screen = read('app/(app)/accounts/[id]/index.tsx')

  it('calcula el saldo con las funciones compartidas de @grana/money-logic', () => {
    expect(section).toMatch(/computeRunningBalances\(/)
    expect(section).toMatch(/runningBalanceCurrencies\(/)
    expect(screen).toMatch(/currencies=\{account\.currencies\}/)
  })

  it('usa la lista y la fila compartidas con la pestaña Movimientos', () => {
    expect(section).toMatch(/import \{ MovementList \} from '\.\.\/movements\/MovementList'/)
    expect(section).not.toMatch(/from '\.\/MovementRow'/)
    expect(row).toMatch(/legInCurrency\(fullView, currencyLens\)/)
    expect(row).toMatch(/runningBalanceSnapshot/)
  })

  it('es una lista corrida: sin selector de mes, con «Desde / Hasta» y «Cargar más»', () => {
    expect(section).not.toMatch(/shiftMonth|ChevronLeft/)
    expect(section).toMatch(/showDateRange/)
    expect(section).toMatch(/MOVEMENTS_LIMIT_STEP/)
    expect(filters).not.toMatch(/resolveMonthRange/)
    expect(filters).toMatch(/filters\.dateFrom && tx\.date < filters\.dateFrom/)
  })

  it('oculta el saldo con filtros o búsqueda, pero no por la moneda ni por las fechas', () => {
    expect(section).toMatch(
      /activeFilterCount\(\{ \.\.\.filters, currency: null, dateFrom: null, dateTo: null \}\) === 0 &&\s*filters\.query\.trim\(\)\.length === 0/,
    )
  })

  it('con la lente visible la moneda no es un filtro: ni hoja, ni chip, ni cuenta', () => {
    expect(section).toMatch(/showCurrencyLens = running\.currencies\.length > 1/)
    expect(section).toMatch(/showCurrencyFilter=\{!showCurrencyLens\}/)
    expect(section).toMatch(/filters\.currency && !showCurrencyLens/)
    expect(section).toMatch(/activeFilterCount\(showCurrencyLens \? \{ \.\.\.filters, currency: null \} : filters\)/)
  })

  it('el tono sale de resolveTone, como en la web, y el signo va pegado', () => {
    expect(row).toMatch(/resolveTone\(movement\.kind, view\.sign/)
    expect(row).not.toMatch(/'- '|'\+ '/)
  })
})
