/**
 * Guidance ID Catalog
 *
 * IDs conocidos para hints contextuales. Evita strings sueltos imposibles de limpiar.
 * Agregar nuevos IDs aquí antes de usarlos en componentes.
 */

export const GUIDANCE_IDS = {
  // Primer movimiento — tour guiado (Change: first-movement-tour)
  FIRST_MOVEMENT_TOUR: 'first_movement.tour',

  // Primer movimiento — hints inline (Change 1, reemplazados por el tour)
  FIRST_MOVEMENT_TYPE: 'first_movement.type',
  FIRST_MOVEMENT_ACCOUNT: 'first_movement.account',
  FIRST_MOVEMENT_CATEGORY: 'first_movement.category',
  FIRST_MOVEMENT_SAVED: 'first_movement.saved',

  // Guardar — sugerencia después de un ingreso (Change: add-savings-set-aside).
  // `seen_at` funciona acá como CURSOR MENSUAL: se refresca cada vez que la tira
  // se muestra, así que un segundo ingreso del mismo mes ya no la dispara y al
  // mes siguiente vuelve sola. NUNCA se marca `completed`: eso la mataría para
  // siempre, y es una sugerencia recurrente.
  SAVINGS_SUGGEST_AFTER_INCOME: 'savings.suggest_after_income',

  // Cuentas (Change 2 - no implementado aún)
  // ACCOUNTS_DISCOVERY: 'accounts.discovery',

  // Tarjetas (Change 2 - no implementado aún)
  // CARDS_DISCOVERY: 'cards.discovery',

  // Shared (Change 3 - no implementado aún)
  // SHARED_DISCOVERY: 'shared.discovery',
} as const;

export type GuidanceId = typeof GUIDANCE_IDS[keyof typeof GUIDANCE_IDS];

/**
 * Validar que un guidance_id está en el catálogo conocido
 */
export function isValidGuidanceId(id: unknown): id is GuidanceId {
  return typeof id === 'string' && (Object.values(GUIDANCE_IDS) as string[]).includes(id);
}
