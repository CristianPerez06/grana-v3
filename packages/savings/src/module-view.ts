// Qué MUESTRA el módulo «Ahorro e inversión», decidido una sola vez para las dos
// plataformas — igual que `balance-card-view.ts` hace con la card de saldo.
//
// Acá viven cinco decisiones que se pueden equivocar en silencio:
//
//   1. Si hay algo guardado, que decide entre la card y el estado vacío.
//   2. Cuándo un monto se muestra y cuándo no.
//   3. El orden de los propósitos.
//   4. Cuántos montos muestra una fila.
//   5. En qué moneda entra una fila cuando se la toca.
//
// Escritas dentro de un componente, cada plataforma las volvería a escribir y
// divergirían — que es la forma exacta en que la migración 0051 tuvo que
// deshacer una cuenta duplicada.
//
// RN-safe: sin dependencias de DOM ni de Node.

import type { BalanceCurrency } from '@grana/money-logic'
import type { AvailableSums, Purpose, PurposeSums } from './types'

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
 * ¿Muestra un monto una fila del desglose?
 *
 * Solo si tiene plata. Un propósito de solo pesos ocupa una línea, y «US$ 0» en
 * cada card sería ruido repetido tantas veces como propósitos haya.
 *
 * La card del TOTAL no sigue esta regla y por eso no la pregunta: ahí el par de
 * monedas es fijo, con su divisor, y muestra `$ 0 / US$ 0` cuando no hay saldo.
 * La asimetría es deliberada — una card que cambia de estructura según el día
 * es una card que hay que volver a leer cada vez, y esa es la única de la
 * pantalla que tiene que poder leerse de un vistazo.
 */
export function moduleAmountIsShown(amount: ModuleAmount): boolean {
  return amount.reserved !== 0
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
 *
 * `known` son los propósitos que EXISTEN, que no es lo mismo que los que tienen
 * plata: el corte por moneda sale de la tabla de repartos, así que uno recién
 * creado no aparece en ninguna fila. Sin esta lista, crearlo y no verlo era
 * indistinguible de que no se hubiera creado — y encima no había forma de
 * borrarlo ni de destinarle desde la página, porque no estaba.
 *
 * Van al final por el orden natural: en cero, después de cualquiera con plata.
 */
export function moduleGroups(rows: PurposeSums[], known: Purpose[] = []): ModuleGroup[] {
  const meta = new Map<string, { name: string | null; icon: string | null }>()
  for (const p of known) meta.set(p.id, { name: p.name, icon: p.icon })
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
  const shown = amounts.filter(moduleAmountIsShown)
  return shown.length > 0 ? shown : [amounts[0]]
}

/**
 * En qué moneda abre un grupo cuando se toca su fila.
 *
 * La primera que tenga plata, y pesos si no tiene ninguna. La fila muestra las
 * dos monedas sin sumarlas, pero las operaciones que siguen —volver a usar,
 * apartar— son de UNA moneda (D16), así que entrar exige elegir una. Elegir
 * pesos siempre abriría un propósito de solo dólares en su moneda vacía.
 *
 * Vive acá porque el drawer ya tomaba esta misma decisión por su cuenta: dos
 * copias de la misma regla es exactamente lo que la 0051 vino a enseñar.
 */
export function moduleGroupCurrency(amounts: ModuleAmount[]): BalanceCurrency {
  return amounts.find((a) => a.reserved > 0)?.currency ?? 'ARS'
}
