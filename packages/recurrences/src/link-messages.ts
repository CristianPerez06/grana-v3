import type { BlockingSettlements, LinkErrorCode } from './link'

/**
 * QUÉ MENSAJE CORRESPONDE A UN RECHAZO de vincular, desvincular o registrar por
 * anticipado — dicho en CLAVES de i18n, no en texto: el package no conoce el
 * catálogo, y las dos superficies lo leen con un `t` distinto (next-intl con
 * ámbito en web, plano en nativo).
 *
 * Vive acá y no en cada app porque era exactamente eso: la misma tabla de
 * decisión copiada a mano en `apps/web/app/_actions/recurrences.ts` y en
 * `apps/mobile/lib/recurrences/mutators.ts`. Copiada a mano quiere decir que una
 * de las dos puede quedar atrás sin que nada avise, y quedó: nativo mostraba el
 * error genérico cuando el vencimiento no era una posición del calendario.
 *
 * Las claves vuelven relativas a `recurrences.link.`, que es el único prefijo
 * que las dos apps comparten. Devuelve `null` cuando el fallo NO es un rechazo
 * de este circuito, para que quien llama conserve su propio mensaje.
 */
export function linkErrorMessageKeys(result: {
  linkErrorCode?: LinkErrorCode
  blockedBy?: BlockingSettlements
  errorCode?: string
}): string[] | null {
  if (result.linkErrorCode) return [`errors.${result.linkErrorCode}`]

  if (result.errorCode === 'GRN01') {
    // El mensaje NOMBRA LA ACCIÓN DISPONIBLE para el estado de la liquidación
    // que bloquea: una completada se revierte, una pendiente se cancela, y una
    // pendiente ajena la cancela quien la registró. Decir siempre «revertí»
    // manda al usuario a una operación que el sistema no ofrece para ese estado.
    // `unknown` es no haber podido averiguar cuál liquidación traba: el mensaje
    // dice que hay una y manda a mirarla, en vez de aconsejar una operación que
    // puede no corresponder al estado.
    const key =
      result.blockedBy?.action === 'cancel_own'
        ? 'errors.blocked_cancel_own'
        : result.blockedBy?.action === 'cancel_other'
          ? 'errors.blocked_cancel_other'
          : result.blockedBy?.action === 'unknown'
            ? 'errors.blocked_unknown'
            : 'errors.blocked_revert'
    // Resolver una sola no alcanza cuando hay varias: se dice, o el usuario
    // vuelve a chocar contra lo mismo creyendo que ya lo destrabó.
    return result.blockedBy?.multiple ? [key, 'errors.blocked_multiple'] : [key]
  }

  return null
}

/**
 * Todas las claves que `linkErrorMessageKeys` puede devolver. Existe para que un
 * test pueda exigir que el catálogo las tenga TODAS, en los dos idiomas: una
 * clave faltante no rompe nada en compilación y se ve recién en pantalla.
 */
export const LINK_ERROR_MESSAGE_KEYS: readonly string[] = [
  'errors.movement_incompatible',
  'errors.movement_already_linked',
  'errors.movement_shared_elsewhere',
  'errors.conversion_not_confirmed',
  'errors.not_linked',
  'errors.not_an_occurrence',
  'errors.beyond_limit',
  'errors.already_resolved',
  'errors.blocked_revert',
  'errors.blocked_cancel_own',
  'errors.blocked_cancel_other',
  'errors.blocked_multiple',
]
