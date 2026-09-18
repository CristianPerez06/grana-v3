import { describe, expect, it } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import {
  invalidateAfterRecurrenceMutation,
  invalidateAfterRecurrenceResolution,
} from '../invalidate'

/**
 * QUÉ SE VUELVE A LEER DESPUÉS DE TOCAR UNA RECURRENCIA.
 *
 * El hub nativo llamaba al helper angosto después de registrar un pago por
 * anticipado: la recurrencia se actualizaba y el saldo de la cuenta, el feed de
 * movimientos y el dashboard seguían mostrando lo de antes. El usuario veía el
 * vencimiento resuelto y su plata sin moverse — dos respuestas distintas a la
 * misma pregunta, en la misma pantalla.
 */

const spy = () => {
  const keys: string[][] = []
  const client = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
      keys.push(queryKey as string[])
      return Promise.resolve()
    },
  } as unknown as QueryClient
  return { client, keys }
}

describe('invalidación después de una mutación de recurrencia', () => {
  it('resolver un vencimiento vuelve a leer también la plata', () => {
    const { client, keys } = spy()
    invalidateAfterRecurrenceResolution(client)

    // El movimiento que queda colgado de la ocurrencia corre el saldo de la
    // cuenta, el feed, los agregados del dashboard, el resumen de la tarjeta y
    // la deuda del hogar.
    expect(keys.map(([prefix]) => prefix).sort()).toEqual([
      'accounts',
      'cards',
      'dashboard',
      'recurrences',
      'shared',
      'transactions',
    ])
  })

  it('la deuda del hogar entra, porque es derivada y nadie la guarda', () => {
    // Vincular un gasto personal a una regla compartida lo convierte, y
    // desvincular lo devuelve a personal: las dos cosas mueven lo que cada
    // miembro le debe al otro. Sin este prefijo, Compartido seguía mostrando la
    // deuda de antes —el gemelo en web revalida `/shared` desde siempre—.
    const { client, keys } = spy()
    invalidateAfterRecurrenceResolution(client)
    expect(keys).toContainEqual(['shared'])
  })

  it('cada clave es un PREFIJO, que es como TanStack empareja', () => {
    // `['transactions']` alcanza a `['transactions','list',…]`. Una clave más
    // específica dejaría afuera justo las lecturas que hay que refrescar.
    const { client, keys } = spy()
    invalidateAfterRecurrenceResolution(client)
    for (const key of keys) expect(key).toHaveLength(1)
  })

  it('un cambio de ciclo de vida NO toca la plata', () => {
    // Pausar, reanudar o descartar una sugerencia no crea ni suelta ningún
    // movimiento: invalidar saldos ahí sería trabajo de red por nada.
    const { client, keys } = spy()
    invalidateAfterRecurrenceMutation(client)
    expect(keys).toEqual([['recurrences']])
  })
})
