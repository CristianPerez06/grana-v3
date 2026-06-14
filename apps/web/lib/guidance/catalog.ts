/**
 * Guidance ID Catalog
 *
 * IDs conocidos para hints contextuales. Evita strings sueltos imposibles de limpiar.
 * Agregar nuevos IDs aquí antes de usarlos en componentes.
 */

export const GUIDANCE_IDS = {
  // Primer movimiento (Change 1)
  FIRST_MOVEMENT_TYPE: 'first_movement.type',
  FIRST_MOVEMENT_ACCOUNT: 'first_movement.account',
  FIRST_MOVEMENT_CATEGORY: 'first_movement.category',
  FIRST_MOVEMENT_SAVED: 'first_movement.saved',

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
  return Object.values(GUIDANCE_IDS).includes(id as any);
}
