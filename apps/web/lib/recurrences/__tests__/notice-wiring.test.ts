import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL ACUSE TIENE QUE TENER DÓNDE SALIR.
 *
 * `useRecurrenceNotice` es un contexto con un valor por defecto que NO HACE
 * NADA. Es lo correcto —un componente no debería explotar por dónde lo
 * montaron— pero tiene un costo: si la superficie que lo usa no está dentro del
 * proveedor, el aviso se pierde en silencio. No hay error, no hay warning: la
 * acción funciona y la pantalla se queda muda.
 *
 * Pasó: el detalle de la regla envolvía SÓLO el historial, y las dos acciones
 * de resolver por anticipado viven en la ficha de arriba. Vincular andaba y no
 * decía nada. Renderizar estas pantallas necesita un runtime que esta suite no
 * trae, así que se pinta leyendo el código —una red más gruesa que renderizar,
 * y la que atrapa la omisión que efectivamente ocurrió.
 */

const APP = resolve(__dirname, '../../../app/(app)/transactions/recurring')
const read = (file: string) => readFileSync(resolve(APP, file), 'utf-8').replace(/\r\n/g, '\n')

describe('quién provee el acuse', () => {
  it('el detalle de la regla envuelve TODO lo que avisa, no sólo el historial', () => {
    const page = read('[id]/page.tsx')
    const abre = page.indexOf('<RecurrenceNotice')
    const cierra = page.indexOf('</RecurrenceNotice>')
    expect(abre).toBeGreaterThan(-1)

    // La ficha de arriba monta las dos acciones de resolver por anticipado; el
    // historial monta desvincular. Los tres avisan, así que los tres van dentro.
    for (const dentro of ['<RecurrenceDetail', '<RecurrenceInstancesList']) {
      const pos = page.indexOf(dentro)
      expect(pos, `${dentro} no está en la página`).toBeGreaterThan(-1)
      expect(pos, `${dentro} quedó fuera del proveedor`).toBeGreaterThan(abre)
      expect(pos, `${dentro} quedó fuera del proveedor`).toBeLessThan(cierra)
    }
  })

  it('el hub lo provee sobre las tarjetas de próximos vencimientos', () => {
    expect(read('_components/upcoming-recurrences.tsx')).toContain('<RecurrenceNotice>')
  })

  it('no hay más consumidores del acuse que los conocidos', () => {
    // Si aparece uno nuevo, este test falla y obliga a contestar la pregunta que
    // nadie se hace sola: ¿está montado dentro de un proveedor?
    const walk = (dir: string): string[] =>
      readdirSync(resolve(APP, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
        return entry.isDirectory() ? walk(rel) : rel.endsWith('.tsx') ? [rel] : []
      })

    const consumidores = walk('.').filter((f) => read(f).includes('useRecurrenceNotice('))
    expect(consumidores.sort()).toEqual([
      '[id]/_components/unlink-instance-button.tsx',
      '_components/resolve-ahead-actions.tsx',
    ])
  })
})
