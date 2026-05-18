'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reverseCardPayment } from '@/app/_actions/credit-cards'

type Props = {
  paymentId: string
  cardId: string
}

export const ReversePaymentDialog = ({ paymentId, cardId }: Props) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleReverse = () => {
    setError(null)
    startTransition(async () => {
      const result = await reverseCardPayment(paymentId)
      if (!result.ok) {
        setError(result.formError ?? 'Error al revertir el pago.')
      } else {
        setOpen(false)
        router.push(`/cards/${cardId}`)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-destructive hover:underline"
      >
        Revertir pago
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-base font-semibold">Revertir pago del resumen</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Esta acción:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Vuelve todas las cuotas del resumen a <strong>pendiente</strong></li>
                <li>Elimina el gasto de pago de tu cuenta</li>
                <li>El período siguiente (si se creó al pagar) <strong>no se elimina</strong></li>
              </ul>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReverse}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Revirtiendo…' : 'Revertir pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
