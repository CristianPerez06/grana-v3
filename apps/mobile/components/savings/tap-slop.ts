/**
 * El área táctil que le falta a un control para llegar a los 44px del repo,
 * SIN que se la cobre al layout.
 *
 * En web esos 44px salen de un `::after` que no ocupa lugar; en nativo no hay
 * pseudo-elementos, así que estaban puestos como alto real —`min-h-[44px]`— y
 * eso hacía que la fila del rótulo «Para qué» midiera 44px para mostrar una
 * palabra, y que cada fila de chips midiera 10px más que en web. En una sheet
 * topeada al 90% de la pantalla, eso es lugar que se le come al CTA.
 *
 * `hitSlop` es el equivalente nativo del pseudo-elemento: extiende el toque, no
 * la caja.
 *
 * El de los chips es SOLO VERTICAL: se tocan de a dos por fila con seis píxeles
 * de separación, y un slop horizontal los solaparía — un toque cerca del borde
 * elegiría el de al lado.
 */
export const TAP_SLOP = { top: 12, bottom: 12, left: 8, right: 8 }
export const CHIP_SLOP = { top: 5, bottom: 5 }
