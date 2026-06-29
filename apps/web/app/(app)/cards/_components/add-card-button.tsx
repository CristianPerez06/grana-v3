'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Fab } from '@/components/ui/fab'
import { CreateCardForm, type CardNetwork } from './create-card-form'
import type { Institution } from '@/lib/accounts/types'

/**
 * Header action on the cards list: opens the "Alta de tarjeta" drawer (the twin
 * of the edit drawer). Trigger and Drawer are colocated, so this owns the open
 * state directly — no context needed. The `/cards/new` page stays as the no-JS
 * fallback. The form remounts on each open (`key`) to reset to a clean state.
 */
export function AddCardButton({
  institutions,
  networks,
  disabled = false,
}: {
  institutions: Institution[]
  networks: CardNetwork[]
  disabled?: boolean
}) {
  const t = useTranslations('cards')
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  const openCreate = () => {
    if (disabled) return
    setFormInstance((n) => n + 1)
    setOpen(true)
  }

  return (
    <>
      <Button
        className="hidden w-auto sm:inline-flex"
        disabled={disabled}
        onClick={openCreate}
      >
        <Plus className="size-4" aria-hidden />
        {t('actions.add_label')}
      </Button>
      <Fab label={t('actions.add_label')} disabled={disabled} onClick={openCreate} />
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('new.drawer_title')}>
        <CreateCardForm
          key={formInstance}
          institutions={institutions}
          networks={networks}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}
