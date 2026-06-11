'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { CreateCategoryForm } from '../new/_components/create-category-form'

/**
 * Header action on the categories list: opens the "Nueva categoría" drawer.
 * Trigger and Drawer are colocated, so this owns the open state directly — no
 * context needed. The `/settings/categories/new` page stays as the no-JS
 * fallback. The form remounts on each open (`key`) to reset to clean state.
 */
export function CreateCategoryButton() {
  const t = useTranslations('settings.categories')
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
        {t('actions.add')}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('new.title')}>
        <CreateCategoryForm
          key={formInstance}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}
