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
      // O invalida, O entrega el éxito hacia arriba. Un formulario que vive
      // dentro de otro componente no es quien debe releer las cachés: reporta
      // que salió bien y el que lo montó —que es el que sigue en pantalla—
      // invalida. Esa delegación se verifica del otro lado, en el caso que
      // exige que la acción del hub abra la hoja y que el padre invalide.
      const delegates = /onDone\(\)/.test(code)
      expect(
        code.includes('invalidateAfterRecurrenceResolution') || delegates,
        'ni invalida ni delega el éxito',
      ).toBe(true)
      // El helper angosto sólo relee `['recurrences']`: usarlo acá es el defecto.
      expect(code).not.toContain('invalidateAfterRecurrenceMutation(')
    })
  }
})

/**
 * «YA LO PAGUÉ» PIDE LOS MISMOS DATOS EN LAS DOS PLATAFORMAS.
 *
 * El spec fijaba antes que en nativo el registro usara los valores de la regla
 * sin edición, y el QA mostró el costo: pagar antes suele venir con otro
 * importe, así que el usuario registraba un número que sabía equivocado. No era
 * una divergencia impuesta por la plataforma —la única clase que el repo
 * admite—, así que se emparejó.
 *
 * Se pinta leyendo el código porque renderizar una pantalla nativa necesita un
 * runtime que esta suite no trae. Red gruesa, y la que atrapa la regresión que
 * importa: que el registro vuelva a mandarse sin lo que el usuario eligió.
 */
describe('registrar por anticipado, en nativo', () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
  const sheet = read('components/recurrences/PayAheadSheet.tsx')

  it('manda importe, cuenta y fecha de pago, no sólo el vencimiento', () => {
    expect(sheet).toContain('registerRecurrenceAhead(')
    for (const field of ['date,', 'amount: parsed,', 'accountId,']) {
      expect(sheet, `falta ${field} en el registro`).toContain(field)
    }
  })

  it('avisa antes de confirmar si la cuenta quedaría en negativo', () => {
    expect(sheet).toContain('checkNegativeBalance')
    expect(sheet).toContain('transactions.form.negative_warning')
  })

  it('no deja confirmar mientras las cuentas no cargaron', () => {
    // Sin las cuentas no hay saldo contra el que avisar, y confirmar en ese
    // hueco registra el pago sin la advertencia que el spec exige.
    expect(sheet).toContain('disabled={pending || !accountsReady}')
  })

  it('la acción del hub abre la hoja en vez de registrar de una', () => {
    const actions = read('components/recurrences/ResolveAheadActions.tsx')
    expect(actions).toContain('onPress={openPayAhead}')
    expect(actions).not.toContain('registerRecurrenceAhead(')
  })
})
