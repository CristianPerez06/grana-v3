/**
 * Si el módulo «Ahorro e inversión» está prendido.
 *
 * HOY sale de una variable de entorno, que es lo único que el repo puede
 * resolver: no hay tabla de planes ni sistema de banderas. Sirve para el caso
 * que sí existe —apagarlo en un entorno, o para depurar el estado degradado—
 * y no para el que todavía no —apagarlo por plan, que es por usuario.
 *
 * El día que exista el plan, lo ÚNICO que cambia es esta función. La decisión de
 * qué implica estar apagado vive en `@grana/savings/module-access.ts`, es pura y
 * está testeada, y no sabe de dónde viene la bandera. Ese corte es a propósito:
 * el riesgo de esta feature no está en leer un booleano, está en qué pasa con la
 * plata de alguien cuando ese booleano es `false`.
 *
 * Prendido por defecto. Una bandera que apaga por omisión es una bandera que
 * apaga sola el día que alguien despliega sin configurarla.
 */
export const savingsModuleEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_SAVINGS_MODULE !== 'off'
