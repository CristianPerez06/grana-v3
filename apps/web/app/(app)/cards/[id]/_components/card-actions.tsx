'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deactivateCreditCardAccount } from '@/app/_actions/credit-cards'
import { reactivateAccount } from '@/app/_actions/accounts'
import { DeactivateBlockDialog } from '../../_components/deactivate-block-dialog'
import { InactiveCardBanner } from '../../_components/inactive-card-banner'

type Props = {
  cardId: string
  isActive: boolean
}

export const CardActions = ({ cardId, isActive }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await deactivateCreditCardAccount(cardId)
      if (!result.ok) {
        if (result.formError === 'pending_debt') {
          setBlockDialogOpen(true)
        } else {
          setError(result.formError ?? 'Error al archivar')
        }
      }
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? 'Error al reactivar')
      }
    })
  }

  return (
    <>
      {!isActive && (
        <InactiveCardBanner onReactivate={handleReactivate} isPending={isPending} />
      )}

      {isActive && (
        <div className="flex items-center gap-3 text-sm">
          <a
            href={`/cards/${cardId}/edit`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Editar
          </a>
          <button
            onClick={handleDeactivate}
            disabled={isPending}
            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            Archivar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <DeactivateBlockDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
      />
    </>
  )
}
