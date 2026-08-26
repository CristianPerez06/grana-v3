'use client'

import { createContext, useContext } from 'react'
import type { BalanceCurrency } from '@grana/money-logic'
import type { Purpose } from '@grana/savings'

/**
 * Cómo la lista le pide al módulo que abra el overlay.
 *
 * Un contexto y no un prop porque entre los dos hay un borde de servidor: el
 * desglose entra a la foto como `children` —lo arma la página, con su propia
 * consulta y su propio Suspense— y por ahí no pasa una función. La alternativa
 * era subir la consulta del desglose a la foto, que es justo lo que las dos
 * secciones separadas evitan: un fallo del desglose se llevaría el número y los
 * botones, que es lo único que no puede faltar.
 *
 * Las tres son INTENCIONES, no vistas del overlay: la moneda viaja porque sale
 * de los datos del desglose (la primera que tenga plata), pero qué pantalla abre
 * cada una lo decide la foto, que es la que tiene el estado. La lista no conoce
 * la pila del overlay.
 */
export type SavingsOverlay = {
  /** Una fila con nombre: entra a su propósito. */
  openPurpose: (purpose: Purpose, currency: BalanceCurrency) => void
  /** Del resto: darle destino. No mueve el disponible. */
  openRestAllocate: (currency: BalanceCurrency) => void
  /** Del resto: volver a usarlo. Esta sí lo mueve. */
  openRestRelease: (currency: BalanceCurrency) => void
}

const SavingsOverlayContext = createContext<SavingsOverlay | null>(null)

export const SavingsOverlayProvider = SavingsOverlayContext.Provider

/**
 * Tira, y no devuelve `null` en silencio: un desglose fuera de la foto sería un
 * árbol mal armado, y su síntoma —filas con chevron que no hacen nada— es
 * exactamente el bug que este cable vino a arreglar.
 */
export const useSavingsOverlay = (): SavingsOverlay => {
  const ctx = useContext(SavingsOverlayContext)
  if (ctx == null) throw new Error('useSavingsOverlay: falta <SavingsOverlayProvider>')
  return ctx
}
