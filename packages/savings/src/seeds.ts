/**
 * Los propósitos sugeridos, y por qué son constantes y no filas.
 *
 * `categories` siembra filas de sistema (`user_id` nulo) y sería el precedente
 * obvio. No se copia: una categoría de sistema no se puede renombrar y está
 * bien —"Comida" le sirve igual a todos—, pero un propósito de sistema tampoco
 * se podría renombrar, y ahí el costo es la fase entera. Si "Viaje" viniera de
 * fábrica, no se podría convertir en "Japón", y el nombre personal ES el valor
 * de esta fase.
 *
 * Así que la sugerencia es un ATAJO DE TIPEO, no una taxonomía: tocarla crea un
 * propósito del usuario, con el nombre precargado y editable en el momento.
 *
 * El nombre va por i18n (`savings.purposes.seeds.<key>`); acá solo viven la
 * clave y el ícono, que no se traducen.
 *
 * `emergency` va primera a propósito: es la única con contenido financiero real
 * detrás, y ponerla a la vista es lo más parecido a un consejo que Grana puede
 * dar sin dar consejos.
 */
export const PURPOSE_SEEDS = [
  { key: 'emergency', icon: '🚑' },
  { key: 'trip', icon: '✈️' },
  { key: 'car', icon: '🚗' },
  { key: 'home', icon: '🏠' },
  { key: 'studies', icon: '🎓' },
] as const

export type PurposeSeed = (typeof PURPOSE_SEEDS)[number]

/**
 * Los íconos elegibles al crear o editar un propósito a mano.
 *
 * Una lista corta y no un teclado de emojis: el ícono acá hace un trabajo
 * concreto —marcar familia en una lista plana, que ✈️ Japón y ✈️ Bariloche se
 * lean juntos sin necesitar jerarquía— y para eso alcanza con que sean pocos y
 * distinguibles de un vistazo.
 */
export const PURPOSE_ICONS = [
  '🚑', '✈️', '🚗', '🏠', '🎓', '💍', '🎁', '🏥', '💻', '👶', '🐶', '🎯',
] as const
