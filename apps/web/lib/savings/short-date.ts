/**
 * La fecha corta del módulo: «5 sept».
 *
 * UNA definición, porque la dibujan dos historiales que se ven en la misma
 * sesión —el del módulo y el de un propósito— y estaban escritas dos veces, con
 * dos APIs distintas (`Intl.DateTimeFormat` y `toLocaleDateString`). Hoy dan lo
 * mismo; el día que una cambie, el usuario ve dos formatos de fecha en la misma
 * app sin que ningún test se entere.
 */
export const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}
