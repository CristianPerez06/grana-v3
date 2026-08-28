/**
 * Cifras de ancho fijo, como el `tabular-nums` de web. En RN se pide por
 * `fontVariant` y no por clase: sin esto, los montos del resumen se corren
 * lateralmente con cada tecla mientras se tipea.
 */
import type { TextStyle } from 'react-native'

export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] }

/**
 * El alto de renglón de la cifra del héroe de monto.
 *
 * Web la deja en `leading-none` y el navegador permite que el glifo se salga de
 * su caja de línea; React Native la RECORTA, así que un `lineHeight` igual al
 * `fontSize` cortaba «$ 50.000» arriba y abajo. Una cifra de 27px ocupa unos 34
 * entre ascendente y descendente: 36 le deja aire y no la mueve de lugar.
 */
export const MONEY_LINE_HEIGHT = 36
