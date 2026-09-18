import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * QUIEN RESUELVE UN VENCIMIENTO, VUELVE A LEER LA PLATA.
 *
 * El test de al lado prueba QUÉ invalida el helper; éste prueba que quien llama
 * lo use, que es donde estuvo el defecto: el hub nativo llamaba al helper
 * angosto y el saldo quedaba viejo. No se puede montar estas pantallas en Node
 * —son React Native— así que se mira el código: es una red más basta que
 * renderizar, y cubre exactamente la omisión que pasó.
 *
 * Si algún día una pantalla resuelve un vencimiento y refresca de otra forma,
 * este test se cae y hay que decidir a propósito, que es el punto.
 */

const ROOT = path.resolve(__dirname, '../../..')
const MUTATIONS = [
  'registerRecurrenceAhead',
  'linkMovementToRecurrence',
  'unlinkMovementFromRecurrence',
]
/** El módulo que expone las mutaciones no invalida nada: no tiene el cliente. */
const EXCLUDED = path.join('lib', 'recurrences', 'mutators.ts')

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(full)) found.push(full)
  }
  return found
}

describe('cableado de la invalidación al resolver un vencimiento', () => {
  const callers = sourceFiles(path.join(ROOT, 'app'))
    .concat(sourceFiles(path.join(ROOT, 'components')), sourceFiles(path.join(ROOT, 'lib')))
    .filter((file) => !file.endsWith(EXCLUDED))
    .map((file) => ({ file: path.relative(ROOT, file), code: readFileSync(file, 'utf8') }))
    .filter(({ code }) => MUTATIONS.some((name) => code.includes(`${name}(`)))

  it('hay al menos un llamador, o el test no está mirando nada', () => {
    // Sin esta guarda, mover o renombrar los archivos volvería el test verde por
    // no encontrar ninguno.
    expect(callers.length).toBeGreaterThan(0)
  })

  for (const { file } of callers) {
    it(`${file} invalida saldos y movimientos, no sólo la recurrencia`, () => {
      const { code } = callers.find((c) => c.file === file)!
      expect(code).toContain('invalidateAfterRecurrenceResolution')
      // El helper angosto sólo relee `['recurrences']`: usarlo acá es el defecto.
      expect(code).not.toContain('invalidateAfterRecurrenceMutation(')
    })
  }
})
