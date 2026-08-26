// Qué MUESTRA el módulo «Ahorro e inversión», decidido una sola vez para las dos
// plataformas — igual que `balance-card-view.ts` hace con la card de saldo.
//
// Acá viven cuatro decisiones que se pueden equivocar en silencio:
//
//   1. Si hay algo guardado, que decide entre la foto y el estado vacío.
//   2. Si se dibuja la columna de dólares.
//   3. El orden de los propósitos.
//   4. Cuántos montos muestra una fila.
//
// Escritas dentro de un componente, cada plataforma las volvería a escribir y
// divergirían — que es la forma exacta en que la migración 0051 tuvo que
// deshacer una cuenta duplicada.
//
// RN-safe: sin dependencias de DOM ni de Node.

import type { BalanceCurrency } from '@grana/money-logic'
import type { AvailableSums, PurposeSums } from './types'

export const MODULE_CURRENCIES: readonly BalanceCurrency[] = ['ARS', 'USD']

export type ModuleAmount = { currency: BalanceCurrency; reserved: number }

export type ModuleGroup = {
  purposeId: string
  name: string
  icon: string | null
  /** Siempre las dos monedas, en el orden de `MODULE_CURRENCIES`. Nunca sumadas. */
  amounts: ModuleAmount[]
}

/** La foto de una moneda. Ausente en la respuesta = todo en cero. */
export function moduleRowFor(sums: AvailableSums[], currency: BalanceCurrency): AvailableSums {
  return (
    sums.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }
  )
}

/**
 * ¿Hay algo guardado, en cualquier moneda?
 *
 * `some` y no una suma: preguntar esto no justifica sumar ARS con USD ni
 * siquiera para un booleano que nadie ve. La regla no tiene excepción de uso.
 */
export function moduleHasSavings(sums: AvailableSums[]): boolean {
  return MODULE_CURRENCIES.some((c) => moduleRowFor(sums, c).reserved > 0)
}

/**
 * ¿Se dibuja la columna de dólares?
 *
 * Solo si hay algún número en dólares. A cero no hay nada que leer y una columna
 * de guiones pide espacio para nada. Aparece el día que hay dólares y se queda:
 * no es la cabecera cambiando de estructura, es una columna que se suma.
 */
export function moduleShowsUsd(sums: AvailableSums[]): boolean {
  const usd = moduleRowFor(sums, 'USD')
  return usd.available !== 0 || usd.reserved !== 0
}

/** Lo guardado en un grupo y una moneda. Ausente en la respuesta = cero. */
export function moduleAmountOf(
  rows: PurposeSums[],
  currency: BalanceCurrency,
  purposeId: string | null,
): number {
  return rows.find((r) => r.currencyCode === currency && r.purposeId === purposeId)?.reserved ?? 0
}

/**
 * Los propósitos con nombre, ordenados por lo que pesan en pesos y, a igualdad,
 * por dólares. «Sin destino» NO está acá: es el resto y va al pie de la lista.
 */
export function moduleGroups(rows: PurposeSums[]): ModuleGroup[] {
  const meta = new Map<string, { name: string | null; icon: string | null }>()
  for (const r of rows) {
    if (r.purposeId == null) continue
    const prev = meta.get(r.purposeId)
    meta.set(r.purposeId, {
      name: prev?.name ?? r.purposeName,
      icon: prev?.icon ?? r.purposeIcon,
    })
  }

  return Array.from(meta, ([purposeId, m]) => ({
    purposeId,
    name: m.name ?? '',
    icon: m.icon,
    amounts: MODULE_CURRENCIES.map((c) => ({
      currency: c,
      reserved: moduleAmountOf(rows, c, purposeId),
    })),
  })).sort(
    (a, b) =>
      b.amounts[0].reserved - a.amounts[0].reserved ||
      b.amounts[1].reserved - a.amounts[1].reserved,
  )
}

/** El resto derivado: `guardado − lo repartido`, por moneda. */
export function moduleRest(rows: PurposeSums[]): ModuleAmount[] {
  return MODULE_CURRENCIES.map((c) => ({ currency: c, reserved: moduleAmountOf(rows, c, null) }))
}

/**
 * Qué montos muestra una fila: los que no son cero, y si todos lo son, el de
 * pesos solo. Una fila con pesos únicamente ocupa una línea; la de un propósito
 * bimoneda crece a dos. Nunca se suman.
 */
export function moduleVisibleAmounts(amounts: ModuleAmount[]): ModuleAmount[] {
  const shown = amounts.filter((a) => a.reserved !== 0)
  return shown.length > 0 ? shown : [amounts[0]]
}
