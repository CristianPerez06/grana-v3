'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { CreateAccountForm } from '../new/_components/create-account-form'
import type { Institution } from '@/lib/accounts/types'

/**
 * Header action on the accounts list: opens the "Crear cuenta" drawer (the twin
 * of the edit drawer). Trigger and Drawer are colocated, so this owns the open
 * state directly — no context needed. The `/accounts/new` page stays as the
 * no-JS fallback. The form remounts on each open (`key`) to reset to clean state.
 */
export function CreateAccountButton({ institutions }: { institutions: Institution[] }) {
  const t = useTranslations('accounts')
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  return (
    <>
      <Button
        className="w-auto"
        onClick={() => {
          setFormInstance((n) => n + 1)
          setOpen(true)
        }}
      >
        <Plus className="size-4" aria-hidden />
        {t('actions.create')}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('actions.create')}>
        <CreateAccountForm
          key={formInstance}
          institutions={institutions}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}
