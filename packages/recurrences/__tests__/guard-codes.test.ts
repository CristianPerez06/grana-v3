import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { RECURRENCE_GUARD_CODES, guardMessageKey } from '../src/guards'

/**
 * CADA RECHAZO DEL PACKAGE LLEVA SU CÓDIGO.
 *
 * El texto en español que acompaña a cada `ok: false` es el fallback; lo que
 * las apps traducen es el `guardCode`. Un rechazo que sólo trae texto vuelve al
 * defecto que esto repara: español crudo en una app en inglés, o «Algo salió
 * mal» en nativo. No se puede exigir por tipos —`guardCode` es opcional porque
 * un resultado puede traer `linkErrorCode` o `mapErrorCode` en su lugar—, así
 * que se mira el código fuente: cada `formError:` con valor dentro de un
 * `ok: false` tiene que tener un `guardCode:` en el mismo objeto.
 */

const SRC = path.resolve(__dirname, '../src')
const FILES = ['mutations.ts', 'link.ts']

function guardlessFormErrors(file: string): string[] {
  const lines = readFileSync(path.join(SRC, file), 'utf-8').split('\n')
  const offenders: string[] = []
  lines.forEach((line, index) => {
    // A `formError:` carrying a value — not the type declaration (`formError?:`)
    // nor a read (`delegated.formError`).
    if (!/\bformError:\s/.test(line) || /formError\?:/.test(line)) return
    const window = lines.slice(Math.max(0, index - 8), index + 1).join('\n')
    if (!/\bok: false\b/.test(window)) return
    if (!/\bguardCode:/.test(window)) offenders.push(`${file}:${index + 1}: ${line.trim()}`)
  })
  return offenders
}

function codesUsed(file: string): Set<string> {
  const src = readFileSync(path.join(SRC, file), 'utf-8')
  return new Set([...src.matchAll(/guardCode: (?:[a-zA-Z]+ \? )?'([a-z_]+)'(?: : '([a-z_]+)')?/g)].flatMap((m) =>
    [m[1], m[2]].filter((code): code is string => Boolean(code)),
  ))
}

describe('códigos de guarda del módulo de recurrencias', () => {
  for (const file of FILES) {
    it(`${file}: ningún rechazo con texto queda sin código`, () => {
      expect(guardlessFormErrors(file)).toEqual([])
    })
  }

  it('todo código que el código usa está en la lista, y toda la lista se usa', () => {
    const used = new Set(FILES.flatMap((file) => [...codesUsed(file)]))
    const listed = new Set<string>(RECURRENCE_GUARD_CODES)
    expect([...used].filter((code) => !listed.has(code))).toEqual([])
    expect([...listed].filter((code) => !used.has(code))).toEqual([])
  })

  it('la clave de catálogo es relativa a `recurrences.`, y null sin código', () => {
    expect(guardMessageKey({ guardCode: 'rule_not_found' })).toBe('guards.rule_not_found')
    expect(guardMessageKey({})).toBeNull()
  })
})
