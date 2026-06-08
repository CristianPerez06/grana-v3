'use client'

import { Pencil, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { useEditCardDrawer } from './edit-card-drawer'

type Props = {
  cardId: string
  /** Hide the register-purchase button (e.g. the empty state already has a big CTA). */
  showAdd?: boolean
}

/**
 * Header actions for the card detail: primary "Registrar consumo" + a pencil
 * icon that opens the edit drawer — same affordance language as the accounts
 * and movement detail headers (icons at the top right, no footer text links).
 */
export const CardHeaderActions = ({ cardId, showAdd = true }: Props) => {
  const t = useTranslations('cards')
  const movementDrawer = useMovementDrawer()
  const editDrawer = useEditCardDrawer()

  return (
    <>
      {showAdd && (
        <Button
          size="sm"
          className="w-auto flex-1 md:flex-initial"
          disabled={!movementDrawer}
          onClick={() => movementDrawer?.openCreate(cardId)}
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          {t('actions.register_purchase')}
        </Button>
      )}
      {editDrawer && (
        <button
          type="button"
          onClick={editDrawer.openEdit}
          aria-label={t('actions.edit')}
          title={t('actions.edit')}
          className="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-border-soft hover:text-text"
        >
          <Pencil className="size-[17px]" aria-hidden />
        </button>
      )}
    </>
  )
}
