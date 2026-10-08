'use client'

import { useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { deleteTransaction } from '@/app/_actions/transactions'
import { invalidateAfterRecurrenceInstanceMutation } from '@/lib/transactions/invalidation'
import { useRecurrenceNotice } from '../../_components/recurrence-notice'

/**
 * «DESHACER» UN PAGO QUE LA RECURRENCIA CREÓ (#104). Borra ese movimiento y el
 * vencimiento vuelve a «por revisar» con los datos de la regla.
 *
 * Es la MISMA operación que «Eliminar» en el detalle del movimiento: llama a la
 * misma acción, con las mismas guardas y los mismos rechazos, y la base reabre la
 * ocurrencia en los dos casos (0075). Dos puertas, un resultado.
 *
 * Sólo se renderiza sobre una ocurrencia resuelta registrando (`canUndo`). Sobre
 * una vinculada, borrar destruiría un gasto que el usuario cargó por su cuenta:
 * para eso está «Desvincular». Se muestra igual cuando algo lo bloquea —un
 * resumen ya pagado, una liquidación vigente— y al tocarlo explica qué resolver.
 */
export const UndoInstanceButton = ({
  transactionId,
  amount,
  account,
  dueDate,
  leavesHistory,
}: {
  transactionId: string
  /** Already formatted, with its sign. */
  amount: string
  account: string
  /** The vencimiento, already formatted; `null` for a payment from before 0064. */
  dueDate: string | null
  /** True when the occurrence leaves the history instead of going back to review. */
  leavesHistory: 'unknown_due_date' | 'deleted_rule' | null
}) => {
  const t = useTranslations('recurrences.link')
  const notify = useRecurrenceNotice()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const close = () => {
    if (pending) return
    setOpen(false)
    setError(null)
  }

  const undo = () => {
    setError(null)
    notify(null)
    startTransition(async () => {
      const result = await deleteTransaction(transactionId)
      if (!result.ok) {
        // El rechazo se lee en el diálogo, al lado de lo que no funcionó: dice
        // qué resolver primero (el pago del resumen, la liquidación).
        setError(result.formError ?? null)
        return
      }
      invalidateAfterRecurrenceInstanceMutation(queryClient, { confirmed: true })
      setOpen(false)
      // El acuse va sobre la lista: esta fila deja de ofrecer «Deshacer».
      notify(t(leavesHistory ? 'undone_success_left_history' : 'undone_success'))
    })
  }

  const outcome =
    leavesHistory === 'deleted_rule'
      ? t('undo_leaves_history_deleted_rule')
      : leavesHistory === 'unknown_due_date' || dueDate == null
        ? t('undo_leaves_history')
        : t('undo_back_to_review', { dueDate })

  return (
    <>
      <div className="ml-auto shrink-0">
        <Button variant="secondary" size="2xs" onPress={() => setOpen(true)}>
          {t('undo')}
        </Button>
      </div>
      <Dialog open={open} onClose={close} ariaLabel={t('undo_title')}>
        <DialogHeader>{t('undo_title')}</DialogHeader>
        <DialogBody>
          <p>{t('undo_body', { amount, account })}</p>
          <p className="font-medium text-text">{outcome}</p>
          {error ? <Alert variant="error">{error}</Alert> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={close} disabled={pending}>
            {t('undo_cancel')}
          </Button>
          <Button variant="destructive" onPress={undo} loading={pending}>
            {pending ? t('undoing') : t('undo_confirm')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
