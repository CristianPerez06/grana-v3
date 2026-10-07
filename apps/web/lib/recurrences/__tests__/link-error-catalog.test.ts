import { describe, expect, it } from 'vitest'
import { en, es } from '@grana/i18n-messages'
import { LINK_ERROR_MESSAGE_KEYS, RESOLVE_AHEAD_MESSAGE_KEYS } from '@grana/recurrences'

/**
 * EL CATÁLOGO TIENE TODOS LOS MENSAJES DEL CIRCUITO, EN LOS DOS IDIOMAS.
 *
 * Una clave que falta no rompe nada al compilar: next-intl y el `t` de nativo
 * devuelven la clave cruda, así que el usuario lee `recurrences.link.errors.…`
 * en pantalla. Se verifica acá y no en `@grana/recurrences` porque el package no
 * depende de los catálogos —y no debería: no conoce idiomas—.
 */

const lookup = (catalog: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as object)) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, catalog)

describe('mensajes de vincular / desvincular / registrar por anticipado', () => {
  for (const [locale, catalog] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(`${locale} tiene texto para cada rechazo`, () => {
      const missing = LINK_ERROR_MESSAGE_KEYS.filter(
        (key) => typeof lookup(catalog, `recurrences.link.${key}`) !== 'string',
      )
      expect(missing).toEqual([])
    })
  }

  it('los dos idiomas dicen cosas distintas: ninguno quedó copiado del otro', () => {
    // Una traducción pegada del español pasa cualquier chequeo de existencia.
    const untranslated = LINK_ERROR_MESSAGE_KEYS.filter(
      (key) =>
        lookup(es, `recurrences.link.${key}`) === lookup(en, `recurrences.link.${key}`),
    )
    expect(untranslated).toEqual([])
  })
})

/**
 * LO MISMO PARA LOS RÓTULOS POR TIPO DE MOVIMIENTO.
 *
 * Estas claves se arman con una plantilla (`already_paid.${kind}`), así que el
 * escáner de claves literales del repo las SALTEA a propósito — no sabe qué vale
 * `kind`. Sin este test, agregar un tipo de movimiento o renombrar uno deja la
 * clave cruda en el botón y nadie se entera hasta abrir la pantalla.
 */
describe('rótulos de resolver por anticipado, por tipo de movimiento', () => {
  for (const [locale, catalog] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(`${locale} tiene rótulo y acuse para cada tipo`, () => {
      const missing = RESOLVE_AHEAD_MESSAGE_KEYS.filter(
        (key) => typeof lookup(catalog, `recurrences.link.${key}`) !== 'string',
      )
      expect(missing).toEqual([])
    })
  }

  it('cada tipo dice algo distinto: ninguno quedó copiado del de gastos', () => {
    // Es el defecto que esto repara: los tres decían «Ya lo pagué». Un catálogo
    // que los tenga los tres iguales pasa cualquier chequeo de existencia.
    for (const base of ['already_paid', 'recorded_success']) {
      const textos = RESOLVE_AHEAD_MESSAGE_KEYS.filter((k) => k.startsWith(`${base}.`)).map(
        (key) => lookup(es, `recurrences.link.${key}`),
      )
      expect(new Set(textos).size, `${base} repite texto entre tipos`).toBe(textos.length)
    }
  })

  it('los dos idiomas dicen cosas distintas', () => {
    const untranslated = RESOLVE_AHEAD_MESSAGE_KEYS.filter(
      (key) => lookup(es, `recurrences.link.${key}`) === lookup(en, `recurrences.link.${key}`),
    )
    expect(untranslated).toEqual([])
  })
})
