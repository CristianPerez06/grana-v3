import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { BalanceCurrency } from '@grana/money-logic'

export const money = (amount: number, currency: BalanceCurrency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * El mismo número, partido en símbolo y dígitos.
 *
 * El diseño pide el símbolo más chico y en menor contraste que la cifra: es lo
 * único que distingue las dos columnas del total, y ponerlo al mismo cuerpo que
 * el monto hacía que «US$ 900» compitiera con «$ 1.150.000».
 *
 * Se parte lo que devuelve `money`, y NO se arma «símbolo + número» por
 * separado: el separador de miles, los decimales y el espacio los decide `Intl`
 * para `es-AR`, y recomponerlos a mano es la forma de que esta pantalla muestre
 * un formato apenas distinto del resto de la app.
 */
export const moneyParts = (
  amount: number,
  currency: BalanceCurrency,
): { symbol: string; digits: string } => {
  const formatted = money(amount, currency)
  // El primer dígito abre la cifra; todo lo anterior es el símbolo. Sirve para
  // «$ 1.150.000» y para «US$ 900», y también para un negativo, donde el signo
  // queda del lado del símbolo.
  const start = formatted.search(/\d/)
  return start <= 0
    ? { symbol: '', digits: formatted }
    : { symbol: formatted.slice(0, start).trim(), digits: formatted.slice(start) }
}
