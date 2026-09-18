'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'

/**
 * EL ACUSE DE HABER RESUELTO UN VENCIMIENTO ANTES DE TIEMPO.
 *
 * La regla del repo es que el cambio de pantalla ES el acuse, y una pantalla que
 * no dice qué pasó no lo cumple. Acá el cambio era mudo: la fila desaparecía y
 * nada más, así que el usuario no sabía si había registrado el pago, si lo había
 * vinculado, o si no había pasado nada.
 *
 * El mensaje NO puede vivir en la fila que se tocó, porque esa fila es justamente
 * la que deja de existir cuando el vencimiento queda resuelto. Vive acá, encima
 * de las dos tarjetas, que siguen montadas: es lo mismo que hace el bloque de
 * vencimientos por revisar, que se queda en pantalla para poder decir «listo».
 */
const NoticeContext = createContext<(message: string) => void>(() => {})

export const useResolveAheadNotice = () => useContext(NoticeContext)

export const ResolveAheadNotice = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null)
  return (
    <NoticeContext.Provider value={setMessage}>
      <div className="flex flex-col gap-4">
        {message ? <Alert variant="success">{message}</Alert> : null}
        {children}
      </div>
    </NoticeContext.Provider>
  )
}
