import type { BalanceCurrency } from '@grana/money-logic'

/**
 * El disponible real de una moneda, tal como lo devuelve `get_available_sums`
 * (migración 0057). `available` viene YA RESTADO desde Postgres: ningún
 * consumidor recompone `accountsNet − reserved` por su cuenta.
 *
 * Puede ser negativo. Si el usuario gastó por encima de lo que había apartado,
 * ese es el hecho y se muestra tal cual; reducir la reserva para que el número
 * cierre sería revocarle en silencio una decisión que no revocó.
 */
export type AvailableSums = {
  currencyCode: BalanceCurrency
  /** Neto de las cuentas propias a la fecha de corte. */
  accountsNet: number
  /** Lo guardado vigente a esa fecha (suma con signo de las reservas). */
  reserved: number
  /** `accountsNet − reserved`. La resta la hace SQL. */
  available: number
}

/**
 * El neto reservado de un período (guardado menos liberado), por moneda.
 *
 * Es un FLUJO, no el stock acumulado: la fila del dashboard lo consume tal cual
 * y poner el acumulado rompería la identidad de la card.
 *
 * Negativo cuando en el período se liberó más de lo que se guardó — ahí la UI
 * gira el verbo con el signo ("Liberaste este mes").
 */
export type ReserveFlowSums = {
  currencyCode: BalanceCurrency
  reservedNet: number
}

/** Una decisión del historial: guardar (positivo) o liberar (negativo). */
export type ReserveEntry = {
  id: string
  currencyCode: BalanceCurrency
  /** Con signo. La UI deriva el verbo de él, no de una columna aparte. */
  amount: number
  date: string
  createdAt: string
}

/**
 * Resultado neutro de una mutación, con la misma forma que el resto del repo:
 * el paquete nunca traduce. `messageKey` es una ruta al catálogo de
 * `@grana/i18n-messages`; `available` / `reserved` acompañan al rechazo para que
 * el mensaje pueda decir el número en vez de "monto inválido".
 */
export type SavingsMutationResult<T = never> =
  | { ok: true; id: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      messageKey?: string
      errorCode?: string
      reason?: 'exceeds_available' | 'exceeds_reserved'
      limit?: number
    }
