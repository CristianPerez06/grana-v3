import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * NINGUNA PANTALLA ELIGE EL RÓTULO POR SU CUENTA.
 *
 * Son tres superficies —la fila de web, la del hub nativo y el título de la hoja
 * nativa— y las tres tienen que decir lo mismo sobre la misma regla. Cuando el
 * rótulo era uno solo y fijo no había nada que sincronizar; ahora que depende
 * del tipo de movimiento, tres copias de la misma tabla de tres entradas es
 * exactamente el patrón que `AGENTS.md` prohíbe.
 *
 * Se lee el código porque renderizar React Native pide un runtime que este
 * monorepo no trae, y porque lo que se quiere atajar es una regresión de
 * escritura: alguien que vuelve a poner la clave a mano.
 *
 * Este archivo vive en `apps/web` y mira `apps/mobile` siguiendo el precedente
 * de `apps/web/lib/__tests__/i18n-message-keys.test.ts`, que escanea las dos
 * apps y los packages desde acá.
 */

const REPO_ROOT = resolve(__dirname, '../../../../..')
const SURFACES = [
  'apps/web/app/(app)/transactions/recurring/_components/resolve-ahead-actions.tsx',
  'apps/mobile/components/recurrences/ResolveAheadActions.tsx',
  'apps/mobile/components/recurrences/PayAheadSheet.tsx',
]

const read = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

describe('el rótulo de resolver por anticipado no se escribe a mano', () => {
  for (const rel of SURFACES) {
    it(`${rel.split('/').pop()} no fija la clave de gasto`, () => {
      const source = read(rel)
      // `already_paid` suelto, sin el tipo pegado detrás, es la clave vieja: la
      // que decía «Ya lo pagué» sobre un sueldo.
      expect(source, 'quedó la clave fija').not.toMatch(/already_paid['`\s)]/)
      expect(source, 'quedó el acuse fijo').not.toMatch(/recorded_success['`\s)]/)
    })
  }

  it('las dos superficies que deciden usan el helper compartido', () => {
    // La hoja nativa NO decide: recibe el rótulo ya elegido por quien la monta,
    // para que el botón que la abre y su título no puedan divergir.
    for (const rel of SURFACES.slice(0, 2)) {
      expect(read(rel), `${rel} elige por su cuenta`).toContain('resolveAheadMessageKeys(')
    }
    expect(read(SURFACES[2])).toContain('actionKey')
  })
})
