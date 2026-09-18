'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { unlinkMovementFromRecurrence } from '@/app/_actions/recurrences'

/**
 * SOLTAR UNA ASOCIACIÓN EQUIVOCADA. El movimiento no se borra —la recurrencia no
 * lo creó, lo cargó el usuario— y el vencimiento vuelve a «por revisar».
 *
 * Sólo se renderiza sobre una ocurrencia resuelta POR VINCULACIÓN (`canUnlink`).
 * Sobre un pago que la recurrencia creó, deshacer significaría borrar un gasto
 * real del historial, que es otra operación con su propio alcance (#104).
 *
 * Cuando una liquidación vigente impide revertir la conversión a compartido, la
 * operación NO se hace a medias: el mensaje dice qué hay que resolver primero, y
 * nombra la acción que corresponde al estado de esa liquidación —revertirla si
 * está completada, cancelarla si está pendiente— porque «revertir» sobre una
 * pendiente manda a una operación que el sistema no ofrece para ese estado.
 */
export const UnlinkInstanceButton = ({ instanceId }: { instanceId: string }) => {
  const t = useTranslations('recurrences.link')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const unlink = () => {
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await unlinkMovementFromRecurrence(instanceId)
      if (!result.ok) {
        setError(result.formError ?? null)
        return
      }
      // Acá la ocurrencia se queda en pantalla —vuelve a «por revisar»—, así que
      // el acuse puede vivir al lado del botón que dejó de ofrecerse.
      setDone(true)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="secondary" size="xs" onPress={unlink} disabled={pending}>
        {pending ? t('unlinking') : t('unlink')}
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {done ? <Alert variant="success">{t('unlinked_success')}</Alert> : null}
    </div>
  )
}
