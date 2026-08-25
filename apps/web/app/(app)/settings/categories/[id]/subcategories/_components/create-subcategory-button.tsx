'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Fab } from '@/components/ui/fab'
import { CreateSubcategoryForm } from '../new/_components/create-subcategory-form'

/**
 * Header action on the subcategories list: opens the "Nueva subcategoría" drawer
 * for the category in the path. Trigger and Drawer are colocated (own open state).
 * The `…/subcategories/new` page stays as the no-JS fallback. `disabled` keeps the
 * button visible from first paint while the parent category resolves.
 */
type Props = {
  categoryId: string
  disabled?: boolean
}

export function CreateSubcategoryButton({ categoryId, disabled = false }: Props) {
  const t = useTranslations('settings.categories')
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  const openCreate = () => {
    setFormInstance((n) => n + 1)
    setOpen(true)
  }

  return (
    <>
      <Button className="hidden w-auto md:inline-flex" disabled={disabled} onClick={openCreate}>
        <Plus className="size-4" aria-hidden />
        {t('actions.add')}
      </Button>
      <Fab label={t('actions.add')} disabled={disabled} onClick={openCreate} />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        widthPx={540}
        ariaLabel={t('subcategories.new.title')}
      >
        <CreateSubcategoryForm
          key={formInstance}
          categoryId={categoryId}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}
