// En qué estado está el módulo «Ahorro e inversión» para un usuario, decidido
// una sola vez y para las dos plataformas.
//
// Existe porque apagar el módulo NO es esconder una pantalla: el guardado sigue
// restando del disponible esté prendido o apagado —`disponible = cuentas −
// guardado` es un hecho sobre la plata, no una función—, así que alguien con
// $180.000 guardados y el módulo apagado tendría $180.000 menos para gastar y
// ninguna forma de recuperarlos. Su plata quedaría rehén de una bandera.
//
// La bandera controla la SUPERFICIE, nunca los números. Ninguna función de acá
// toca un monto.
//
// RN-safe: sin dependencias de DOM ni de Node.

import type { AvailableSums } from './types'
import { moduleHasSavings } from './module-view'

/**
 * - `on`: el módulo completo.
 * - `off`: no existe para este usuario, y no le falta nada.
 * - `degraded`: apagado, pero con plata adentro. El MISMO módulo con menos
 *   cosas: se lee y se puede volver a usar. Nunca una superficie paralela.
 */
export type ModuleAccess = 'on' | 'off' | 'degraded'

/**
 * El tercer estado no es una cortesía: es la única salida que le queda a la
 * plata. Sin él, apagar el módulo sería quedarse con lo guardado.
 */
export function moduleAccess(enabled: boolean, sums: AvailableSums[]): ModuleAccess {
  if (enabled) return 'on'
  return moduleHasSavings(sums) ? 'degraded' : 'off'
}

/** ¿Hay entrada de menú y ruta navegable? Solo con el módulo entero. */
export function moduleShowsNav(access: ModuleAccess): boolean {
  return access === 'on'
}

/**
 * ¿La ruta responde?
 *
 * También en degradado, y sin entrada de menú: es a donde lleva la fila del
 * dashboard, que es la última puerta que le queda a esa plata. Una ruta que
 * devuelve 404 con guardado adentro es el secuestro.
 */
export function moduleRouteIsOpen(access: ModuleAccess): boolean {
  return access !== 'off'
}

/**
 * ¿Se dibuja la fila de Guardado en el dashboard?
 *
 * Con guardado en cero y el módulo apagado no hay nada que decir. Con plata
 * adentro se queda SIEMPRE: es la única puerta.
 */
export function moduleShowsDashboardRow(access: ModuleAccess, sums: AvailableSums[]): boolean {
  return access === 'on' || (access === 'degraded' && moduleHasSavings(sums))
}

/**
 * Qué se puede hacer.
 *
 * En degradado queda UNA acción: volver a usar. No guardar —sumar plata a un
 * módulo apagado es empeorar el problema—, no destinar ni quitar destino —repartir
 * no saca nada y sería administrar algo que ya no se ofrece— y no crear
 * propósitos.
 *
 * `read` sobrevive porque la ACCIÓN la necesita: el invariante de la fase 2 no
 * deja sacar de un grupo sin nombrarlo, así que la lista tiene que estar para
 * poder elegir el origen. No es decoración, es el mínimo para que la plata
 * salga.
 */
export type ModuleAbility = 'read' | 'release' | 'save' | 'allocate' | 'createPurpose'

export function moduleCan(access: ModuleAccess, ability: ModuleAbility): boolean {
  if (access === 'on') return true
  if (access === 'off') return false
  return ability === 'read' || ability === 'release'
}
