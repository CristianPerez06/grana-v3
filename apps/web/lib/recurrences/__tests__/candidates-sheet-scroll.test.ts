import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * LA HOJA DE CANDIDATOS TIENE QUE SCROLLEAR A ANCHO DE TELÉFONO.
 *
 * El `Drawer` es panel lateral en escritorio —altura fija, `md:h-dvh`— y hoja
 * inferior abajo de `md`, donde la altura la fija el contenido con un tope
 * (`max-h-[90dvh]`). Contra un padre de altura automática, un `h-full` no vale
 * nada: el cuerpo crece con la lista, el panel la recorta y no hay nada que
 * scrollear. El primitivo lo dice en su propio comentario —espera un cuerpo
 * `min-h-0 flex-1`— y esta hoja no lo cumplía.
 *
 * Se vio recién en el QA, a 360px, con una lista larga: ninguna regla dejaba
 * mover la lista. En escritorio funcionaba, así que nada lo delataba antes.
 *
 * Es un test de código y no de render porque el defecto es de LAYOUT: sólo
 * aparece con un alto de viewport real y contenido que lo desborda, que es
 * exactamente lo que un render sin navegador no tiene. Red gruesa, pero fija la
 * omisión que ocurrió.
 */

const FILE = resolve(
  __dirname,
  '../../../app/(app)/transactions/recurring/_components/link-candidates-drawer.tsx',
)
const source = readFileSync(FILE, 'utf-8').replace(/\r\n/g, '\n')

describe('el cuerpo de la hoja de candidatos', () => {
  it('se deja achicar por el panel en vez de estirarse con su contenido', () => {
    expect(source).toContain('flex min-h-0 flex-1 flex-col')
    // `h-full` es el que rompía: en la hoja inferior resuelve a `auto`.
    expect(source).not.toContain('flex h-full flex-col')
  })

  it('la región que lista los candidatos es la que scrollea, y puede achicarse', () => {
    expect(source).toContain('min-h-0 flex-1 overflow-y-auto')
  })
})
