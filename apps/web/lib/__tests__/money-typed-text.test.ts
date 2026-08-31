import { describe, expect, it } from 'vitest'
import { formatForDisplay, resolveTypedMoneyText } from '@grana/validation'

/**
 * `resolveTypedMoneyText` — el `.` de miles no es el `.` de centavos.
 *
 * En React Native el campo solo recibe el TEXTO resultante, así que un `.` es
 * ambiguo: puede ser el que el usuario acaba de tipear para los centavos, o el
 * de agrupación que ya estaba en pantalla y quedó al final al borrar un dígito.
 *
 * Encontrado en el QA visual nativo: escribir `5.000` y borrar un dígito
 * devolvía **`5,00`** en vez de `500`. Web no tiene el bug porque intercepta la
 * tecla `.` en el `keydown` y sabe que el usuario la tipeó.
 *
 * Cada caso simula un paso real: lo que el campo venía MOSTRANDO, y el texto
 * que devuelve `onChangeText`.
 */

/** Un paso de tipeo: del display anterior al nuevo display. */
const paso = (display: string, incoming: string) =>
  formatForDisplay(resolveTypedMoneyText(display, incoming))

describe('borrar nunca introduce un decimal', () => {
  it('5.000 → borrar un dígito → 500, no 5,00', () => {
    expect(paso('5.000', '5.00')).toBe('500')
  })

  it('500.000 → borrar un dígito → 50.000', () => {
    expect(paso('500.000', '500.00')).toBe('50.000')
  })

  it('1.234.567 → borrar un dígito → 123.456', () => {
    expect(paso('1.234.567', '1.234.56')).toBe('123.456')
  })

  it('borrar sobre un número sin punto de miles sigue andando', () => {
    expect(paso('500', '50')).toBe('50')
  })

  it('borrar el punto de miles mismo lo devuelve agrupado', () => {
    expect(paso('5.000', '5000')).toBe('5.000')
  })
})

describe('el punto que el usuario SÍ tipeó llega a los centavos', () => {
  it('500 → tipear «.» → 500,', () => {
    expect(paso('500', '500.')).toBe('500,')
  })

  it('500, → tipear «5» → 500,5', () => {
    expect(paso('500,', '500,5')).toBe('500,5')
  })

  it('500 → «.» y dos dígitos → 500,25', () => {
    expect(paso('500', '500.')).toBe('500,')
    expect(paso('500,', '500,2')).toBe('500,2')
    expect(paso('500,2', '500,25')).toBe('500,25')
  })

  it('un punto tipeado sobre un número con miles también es decimal', () => {
    expect(paso('5.000', '5.000.')).toBe('5.000,')
  })
})

describe('lo que no cambia', () => {
  it('tipear dígitos agrupa como siempre', () => {
    expect(paso('', '1')).toBe('1')
    expect(paso('1', '12')).toBe('12')
    expect(paso('123', '1234')).toBe('1.234')
  })

  it('vaciar el campo lo deja vacío', () => {
    expect(paso('5.000', '')).toBe('')
  })
})
