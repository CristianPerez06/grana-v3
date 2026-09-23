'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'

/**
 * EL ACUSE DE LO QUE SE HIZO CON UN VENCIMIENTO.
 *
 * La regla del repo es que el cambio de pantalla ES el acuse, y una pantalla que
 * no dice qué pasó no lo cumple. Acá el cambio era mudo: la fila desaparecía y
 * nada más, así que el usuario no sabía si había registrado el pago, si lo había
 * vinculado, o si no había pasado nada.
 *
 * El mensaje NO puede vivir en el control que se tocó, porque ese control es
 * justamente el que deja de existir cuando la operación sale bien: la fila
 * desaparece al resolver el vencimiento, y el botón de desvincular deja de
 * ofrecerse cuando la ocurrencia vuelve a «por revisar». Un acuse montado ahí
 * se desmonta con él y no se llega a leer. Vive acá, sobre la lista, que sigue
 * montada.
 *
 * Lo usan el hub (registrar y vincular por anticipado) y el detalle de la regla
 * (desvincular). Los errores NO pasan por acá: cuando algo falla el control
 * sigue en pantalla, y el mensaje va al lado de lo que no funcionó.
 */
const NoticeContext = createContext<(message: string | null) => void>(() => {})

export const useRecurrenceNotice = () => useContext(NoticeContext)

export const RecurrenceNotice = ({
  children,
  /**
   * La separación que los hijos tenían entre sí antes de que el proveedor los
   * envolviera. Va acá y no en el contenedor de afuera para que el aviso quede
   * pegado a lo que anuncia: una pantalla con los bloques bien separados no
   * tiene por qué dejar ese mismo hueco entre el «listo» y el contenido.
   */
  contentClassName,
}: {
  children: ReactNode
  contentClassName?: string
}) => {
  const [message, setMessage] = useState<string | null>(null)
  return (
    <NoticeContext.Provider value={setMessage}>
      <div className="flex flex-col gap-4">
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className={contentClassName}>{children}</div>
      </div>
    </NoticeContext.Provider>
  )
}
