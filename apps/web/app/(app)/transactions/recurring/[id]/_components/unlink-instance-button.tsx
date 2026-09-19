'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { unlinkMovementFromRecurrence } from '@/app/_actions/recurrences'
import { useRecurrenceNotice } from '../../_components/recurrence-notice'

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
  const notify = useRecurrenceNotice()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const unlink = () => {
    setError(null)
    startTransition(async () => {
      const result = await unlinkMovementFromRecurrence(instanceId)
      if (!result.ok) {
        // El rechazo SÍ vive acá: el botón sigue en pantalla, y el motivo tiene
        // que leerse al lado de lo que no funcionó.
        setError(result.formError ?? null)
        return
      }
      // El acuse, en cambio, no puede vivir acá: al volver la ocurrencia a «por
      // revisar» este botón deja de ofrecerse y se desmonta con el mensaje
      // adentro. Va sobre la lista, que sigue montada.
      notify(t('unlinked_success'))
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="secondary" size="xs" onPress={unlink} disabled={pending}>
        {pending ? t('unlinking') : t('unlink')}
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}
