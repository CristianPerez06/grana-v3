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
 * gira el verbo con el signo ("Volviste a usar este mes").
 */
export type ReserveFlowSums = {
  currencyCode: BalanceCurrency
  reservedNet: number
}

/**
 * Un propósito: para qué se guardó. Un nombre y un ícono, y nada más — sin
 * objetivo, sin fecha y sin progreso, que es lo que lo separa de una meta.
 */
export type Purpose = {
  id: string
  name: string
  icon: string | null
}

/**
 * Lo guardado de UN propósito en UNA moneda, tal como lo devuelve
 * `get_purpose_sums` (migración 0058).
 *
 * `purposeId` en null es «Sin destino», y es un GRUPO, no una ausencia: tiene
 * las mismas reglas que cualquier propósito, incluido el piso. `purposeName` en
 * null lo acompaña — el rótulo es copy y vive en i18n, la base no habla
 * castellano.
 *
 * Un propósito puede aparecer en dos filas, una por moneda. No se suman nunca:
 * "Japón" tiene pesos y dólares, y son dos números distintos.
 */
export type PurposeSums = {
  /** `null` es «Sin destino», que acá es EL RESTO: guardado menos lo repartido. */
  purposeId: string | null
  purposeName: string | null
  purposeIcon: string | null
  currencyCode: BalanceCurrency
  /**
   * Lo que le corresponde al grupo. Para un propósito es la suma de sus
   * repartos; para «Sin destino» es el resto. El invariante de la base impide
   * que cualquiera de los dos quede negativo.
   */
  reserved: number
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
 * Un acto del reparto: apartar (positivo) o soltar (negativo).
 *
 * Es el SEGUNDO par de verbos del modelo y vive en su propia tabla porque es un
 * acto distinto: guardar mueve el disponible, repartir no mueve ningún total.
 */
export type AllocationEntry = {
  id: string
  purposeId: string
  currencyCode: BalanceCurrency
  /** Con signo. La UI deriva el verbo de él. */
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
      reason?:
        | 'exceeds_available'
        | 'exceeds_reserved'
        | 'exceeds_purpose_reserved'
        | 'exceeds_unassigned'
      limit?: number
      /** El nombre del propósito cuando el rechazo fue su piso, para que el mensaje lo diga. */
      purposeName?: string | null
      /** El nombre que ya ocupaba el lugar cuando el rechazo fue por duplicado. */
      conflictingName?: string
    }
