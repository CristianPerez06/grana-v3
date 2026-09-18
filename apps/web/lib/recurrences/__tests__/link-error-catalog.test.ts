import { describe, expect, it } from 'vitest'
import { en, es } from '@grana/i18n-messages'
import { LINK_ERROR_MESSAGE_KEYS } from '@grana/recurrences'

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
