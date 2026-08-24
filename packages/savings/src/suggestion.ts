import { Money } from '@grana/validation'
import type { ReserveEntry } from './types'

/**
 * El monto que Grana propone guardar después de un ingreso.
 *
 * La propuesta se arma con un PORCENTAJE, no con un importe. Recordar $200.000
 * sería recordar el sueldo viejo: en cuanto el ingreso cambia, el número deja de
 * tener relación con nada. El 10% de $2.000.000 en agosto propone $250.000 sobre
 * $2.500.000 en septiembre, que es lo que el usuario habría hecho.
 *
 * Y NO existe pantalla de configuración para esto. El porcentaje se deriva de lo
 * que el usuario hizo la última vez; si nunca guardó, es 10%.
 */

/** Primera vez: el 10% es un punto de partida convencional, no un consejo. */
export const DEFAULT_SUGGESTION_PCT = 0.1

/**
 * Piso y techo del porcentaje derivado. Existen porque el cociente se calcula
 * contra el ingreso de un mes, y un mes atípico lo distorsiona: alguien que
 * guardó $100.000 en un mes sin sueldo registrado daría un porcentaje absurdo, y
 * la sugerencia siguiente sería una cifra que nadie va a aceptar. Fuera de rango
 * se vuelve al 10%.
 */
const MIN_PCT = 0.01
const MAX_PCT = 0.9

export type SuggestionInput = {
  /**
   * El ÚLTIMO ingreso del mes, en la moneda de la sugerencia — no el total del
   * mes. La tira aparece después de cobrar, y lo que el usuario está dispuesto a
   * apartar es una parte de eso; el total del mes incluye plata ya gastada.
   */
  latestIncome: number
  /** La última reserva POSITIVA del usuario, si existe. */
  lastSave: ReserveEntry | null
  /** El ingreso del que salió esa reserva (el último anterior a su fecha). */
  incomeAtLastSave: number | null
  /** Disponible de esa moneda ahora mismo. */
  available: number
}

export type Suggestion = {
  amount: number
  /** El porcentaje que se usó, para el copy y para los tests. */
  pct: number
}

/**
 * El porcentaje que el usuario viene usando, derivado de su propia conducta:
 * lo que guardó la última vez sobre el ingreso del que lo sacó.
 *
 * Se deriva en vez de guardarse porque una columna de "porcentaje preferido"
 * sería un dato que el usuario nunca declaró y que habría que mantener
 * sincronizado con lo que realmente hace.
 */
export function deriveSuggestedPct(
  lastSave: ReserveEntry | null,
  incomeAtLastSave: number | null,
): number {
  if (!lastSave || lastSave.amount <= 0) return DEFAULT_SUGGESTION_PCT
  if (incomeAtLastSave == null || incomeAtLastSave <= 0) return DEFAULT_SUGGESTION_PCT

  const pct = lastSave.amount / incomeAtLastSave
  if (!Number.isFinite(pct) || pct < MIN_PCT || pct > MAX_PCT) return DEFAULT_SUGGESTION_PCT
  return pct
}

/**
 * El monto sugerido, o `null` cuando no hay nada sensato que proponer.
 *
 * Devuelve `null` —y por lo tanto la tira no se ofrece— cuando el mes no tuvo
 * ingresos, cuando no queda disponible, o cuando la propuesta redondearía a
 * cero. Proponer guardar plata que no está sería el peor momento posible para
 * que Grana pierda credibilidad.
 *
 * El monto se recorta al disponible: la tira nunca propone algo que el write
 * path va a rechazar.
 */
export function deriveSuggestion(input: SuggestionInput): Suggestion | null {
  if (input.latestIncome <= 0 || input.available <= 0) return null

  const pct = deriveSuggestedPct(input.lastSave, input.incomeAtLastSave)
  const raw = Money.multiply(Money.from(input.latestIncome), pct)
  const capped = Money.toNumber(raw) > input.available ? Money.from(input.available) : raw
  const amount = Money.toNumber(capped)

  if (amount <= 0) return null
  return { amount, pct }
}

/** La última reserva positiva del historial (que ya viene ordenado desc). */
export function lastSaveOf(entries: ReserveEntry[]): ReserveEntry | null {
  return entries.find((e) => e.amount > 0) ?? null
}

/**
 * ¿Corresponde ofrecer la tira?
 *
 * La regla es **una vez por INGRESO**, no una vez por mes. El anti-nagging
 * protege contra que te pregunten cuando no pasó nada; acá sí pasó algo, entró
 * plata. Dos sueldos —una quincena, un freelance que factura varias veces— son
 * dos decisiones distintas, y ofrecer solo la primera se pierde la mitad de los
 * momentos buenos.
 *
 * El tope mensual no desaparece: se vuelve **opt-in**. Quien sienta que es mucho
 * toca "No este mes" y baja a esa cadencia, que es la más lenta que la tira
 * puede tener. No hay apagado permanente, y por eso mismo no hace falta: el peor
 * caso es una vez por mes.
 *
 * Los dos cortes usan columnas distintas de `guidance` y significan cosas
 * distintas:
 *
 * · `seenAt`      cuándo se mostró por última vez. Se compara contra el
 *                 `created_at` del ingreso, así que un ingreso posterior la
 *                 vuelve a habilitar y el mismo ingreso no la repite.
 * · `dismissedAt` "no este mes". Silencia SOLO el mes en que se tocó —
 *                 deliberadamente NO es el "para siempre" que la columna
 *                 significa en el resto de `guidance`, porque una sugerencia
 *                 recurrente que se puede matar de un toque se mata sin querer.
 */
export function shouldOfferSuggestion(input: {
  seenAt: string | null
  dismissedAt: string | null
  /** Mes financiero en curso, `YYYY-MM`. */
  currentMonth: string
  /** `created_at` del último ingreso cargado del mes. Null si no hay ninguno. */
  latestIncomeAt: string | null
}): boolean {
  if (input.dismissedAt != null && input.dismissedAt.slice(0, 7) === input.currentMonth) {
    return false
  }
  if (input.latestIncomeAt == null) return false
  if (input.seenAt == null) return true
  return input.latestIncomeAt > input.seenAt
}
