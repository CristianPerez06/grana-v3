/**
 * El ancho útil de una fila de chips de propósito, para decidir cuántos entran.
 *
 * Dos números y no una medición del DOM: medir obliga a dibujar primero y a
 * replegar después, y eso es un parpadeo de la fila cada vez que se abre el
 * formulario. Son el ancho del panel menos su padding — 360 − 40 en el teléfono
 * más angosto que soportamos, y 480 − 40 en el drawer de escritorio.
 *
 * El del teléfono es el del MÁS ANGOSTO a propósito: en uno más ancho sobra
 * lugar y entra un chip menos de los que podrían, que es un hueco; al revés
 * entraría una fila de más, que es el bug que esto cierra.
 *
 * Viven en su propio módulo y no en `savings-drawer` porque `purpose-allocate`
 * también los usa, y el drawer ya lo importa a él: en el mismo archivo, los dos
 * quedaban en un ciclo.
 */
export const MOBILE_CHIP_ROW_WIDTH = 320
export const DESKTOP_CHIP_ROW_WIDTH = 440
