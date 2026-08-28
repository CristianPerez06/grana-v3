/**
 * Cuántos chips de propósito entran en un número dado de FILAS.
 *
 * El techo de chips era un número fijo —seis— y un número fijo no sabe nada del
 * ancho: con nombres cortos sobraba fila, y con «Meta de ahorro» y «Fondo de
 * emergencia» los mismos seis chips ocupaban cuatro filas y empujaban el resumen
 * y el CTA fuera de la pantalla. En un teléfono el alto es el recurso escaso, y
 * lo que hay que topear es el ALTO, no la cantidad.
 *
 * Vive acá y no adentro de los componentes por el mismo precedente que
 * `module-view.ts`: escrita en el componente, mobile la reescribiría y las dos
 * superficies divergirían.
 */

/**
 * Ancho estimado de un chip, en px: el marco y el emblema, más lo que mide el
 * nombre.
 *
 * Es una ESTIMACIÓN y no una medición: ni React Native ni el render del servidor
 * pueden medir texto antes de dibujarlo, y esperar al layout para recién ahí
 * decidir qué se pliega haría parpadear la fila.
 *
 * Los números salen de medir los chips reales contra la métrica de Plus Jakarta
 * Sans a 13px/600, y están redondeados PARA ARRIBA a propósito: sobreestimar
 * mete un chip de menos —que es un hueco— y subestimar mete una fila de más,
 * que es el bug que esto viene a cerrar.
 */
const CHIP_FRAME = 47
const CHIP_PER_CHAR = 8
/** El `gap-1.5` entre chips. */
const CHIP_GAP = 6

export const estimateChipWidth = (name: string): number =>
  CHIP_FRAME + name.length * CHIP_PER_CHAR

/**
 * Cuántos de `names` entran, en orden, en `maxRows` filas de `rowWidth` px.
 *
 * Corta en el primer chip que no entra y no sigue buscando uno más chico: los
 * chips vienen ordenados por saldo, así que saltear uno para meter el siguiente
 * rompería el orden — que es lo que le dice al usuario dónde mirar.
 *
 * Devuelve al menos 1: un chip más ancho que la fila entra igual, solo que
 * ocupándola entera. Mostrar cero chips y un «Ver más (8)» sería una lista que
 * no muestra nada.
 */
export const fitChipCount = (names: string[], rowWidth: number, maxRows: number): number => {
  let row = 1
  let used = 0
  let count = 0
  for (const name of names) {
    const chip = estimateChipWidth(name)
    const needed = used === 0 ? chip : CHIP_GAP + chip
    // Con la fila vacía el chip entra SIEMPRE, mida lo que mida: si no, un
    // nombre más ancho que la pantalla dejaría la primera fila en blanco y se
    // dibujaría solo en la segunda.
    if (used === 0 || used + needed <= rowWidth) {
      used += needed
    } else {
      if (row >= maxRows) break
      row += 1
      used = chip
    }
    count += 1
  }
  return Math.max(1, count)
}
