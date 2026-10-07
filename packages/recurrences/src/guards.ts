/**
 * CÓDIGOS DE GUARDA del módulo de recurrencias — cada rechazo con el que una
 * mutación dice que no, identificado por un nombre y no por un texto.
 *
 * El package no conoce los catálogos de idioma y no debe conocerlos: web los lee
 * con next-intl y nativo con su propio `t`. Lo que sí puede hacer es DECIR CUÁL
 * fue el rechazo, y dejar que cada plataforma lo traduzca bajo
 * `recurrences.guards.<code>`. Es el mismo mecanismo que `linkErrorMessageKeys`
 * usa para el circuito de vincular; antes de esto el resto de las mutaciones
 * devolvía el texto en español, web lo mostraba tal cual en una app en inglés y
 * nativo lo degradaba a «Algo salió mal».
 *
 * El `formError` en español SE CONSERVA al lado del código: es el fallback para
 * quien no traduce (tests, seams de otros packages) y lo que se muestra si una
 * plataforma recibe un código que todavía no tiene texto.
 *
 * La lista es `as const` y el tipo se deriva de ella, así que un código nuevo que
 * no esté acá es un error de tipos y no una clave cruda en pantalla. El test de
 * catálogo (`apps/web/lib/recurrences/__tests__/link-error-catalog.test.ts`)
 * exige texto en los dos idiomas para cada entrada.
 */
export const RECURRENCE_GUARD_CODES = [
  // Alta y edición de la regla
  'invalid_movement_type',
  'same_account_as_destination',
  'transfer_destination_required',
  'destination_only_for_transfers',
  'category_required',
  'end_date_before_start',
  'limit_below_spent',
  'account_not_found',
  'account_archived',
  'account_currency_inactive',
  'destination_account_not_found',
  'destination_account_archived',
  'destination_account_currency_inactive',
  'no_two_member_household',
  'household_mismatch',
  'split_members_mismatch',
  // Estado de la regla
  'rule_not_found',
  'rule_deleted',
  'rule_deleted_cannot_edit',
  'rule_deleted_cannot_resume',
  // Resolver una ocurrencia
  'instance_not_found',
  'instance_already_resolved',
  'rule_account_missing',
  'rule_account_archived',
  'chosen_account_missing',
  'chosen_account_archived',
  'chosen_account_currency_inactive',
  // La base dijo que no y el package sólo puede repetirlo
  'save_failed',
  'register_failed',
] as const

export type RecurrenceGuardCode = (typeof RECURRENCE_GUARD_CODES)[number]

/** Lo que un rechazo con código lleva además del texto en español. */
export type RecurrenceGuard = {
  guardCode: RecurrenceGuardCode
  guardParams?: Record<string, string | number>
  formError: string
}

/**
 * La clave de catálogo de un rechazo, relativa a `recurrences.` (el único prefijo
 * que las dos apps comparten), o `null` cuando el resultado no trae código y
 * quien llama conserva su propio mensaje.
 */
export function guardMessageKey(result: { guardCode?: RecurrenceGuardCode }): string | null {
  return result.guardCode ? `guards.${result.guardCode}` : null
}
