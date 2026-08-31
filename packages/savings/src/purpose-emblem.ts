/**
 * El emblema de un propósito: su emoji dentro de un cuadro con tinte.
 *
 * Vive en el PAQUETE y no adentro de un componente porque lo dibujan cuatro
 * superficies —la grilla del módulo y el detalle del overlay, en web y en
 * nativa— y tienen que coincidir: el emblema es lo que confirma que la pantalla
 * que se abrió es la card que se tocó. Dos listas de tintes divergiendo sería el
 * mismo propósito con dos colores según dónde se lo mire, y con dos apps la
 * copia se habría hecho sola.
 *
 * Devuelve clases de Tailwind, que es lenguaje común: los tokens salen de
 * `@grana/ui-tokens` y nativewind los resuelve igual que la web.
 *
 * Son cinco tintes del set de la app, no una paleta nueva, y son IDENTIDAD y no
 * significado: no dicen nada del propósito, solo lo hacen reconocible.
 */
export const PURPOSE_TINTS = [
  'bg-slate-soft text-slate-deep',
  'bg-emerald-bg text-emerald-deep',
  'bg-plum-soft text-plum-deep',
  'bg-terracotta-soft text-terracotta-deep',
  'bg-surface-sunken text-text-muted',
] as const

/**
 * El tinte sale del id y NO de la posición en la lista.
 *
 * La lista se ordena por monto y se reordena sola cuando cambian los números; un
 * propósito que cambia de color porque otro creció es un propósito que cuesta
 * reencontrar. Con el id, el color de «Viaje» es el mismo hoy, el mes que viene
 * y en cualquier pantalla que lo dibuje.
 */
export const purposeTint = (purposeId: string): string => {
  let h = 0
  for (let i = 0; i < purposeId.length; i += 1) h = (h * 31 + purposeId.charCodeAt(i)) >>> 0
  return PURPOSE_TINTS[h % PURPOSE_TINTS.length]
}

/** El glifo, con el mismo default en todas partes. */
export const purposeGlyph = (icon: string | null): string => icon ?? '🫙'
