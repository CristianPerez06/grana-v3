/**
 * Cifras de ancho fijo, como el `tabular-nums` de web. En RN se pide por
 * `fontVariant` y no por clase: sin esto, los montos del resumen se corren
 * lateralmente con cada tecla mientras se tipea.
 */
import type { TextStyle } from 'react-native'

export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] }
