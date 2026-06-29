'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Fab } from '@/components/ui/fab'
import { CreateCategoryForm } from '../new/_components/create-category-form'

/**
 * Header action on the categories list: opens the "Nueva categoría" drawer.
 * Trigger and Drawer are colocated, so this owns the open state directly — no
 * context needed. The `/settings/categories/new` page stays as the no-JS
 * fallback. The form remounts on each open (`key`) to reset to clean state.
 */
export function CreateCategoryButton() {
  const t = useTranslations('settings.categories')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  // Bridge: open the create drawer when arriving with `?nuevaCategoria=1` (e.g.
  // the "+ Agregar nueva categoría" shortcut in the movement form), so category
  // creation always shows in the drawer — consistent with the rest of the app.
  // We clean the param afterwards so a refresh or back-nav doesn't reopen it.
  const bridgedRef = useRef(false)
  useEffect(() => {
    if (bridgedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevaCategoria') !== '1') return
    bridgedRef.current = true
    // Intentional: bridge the URL param to drawer state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormInstance((n) => n + 1)
    setOpen(true)
    params.delete('nuevaCategoria')
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [router])

  const openCreate = () => {
    setFormInstance((n) => n + 1)
    setOpen(true)
  }

  return (
    <>
      <Button className="hidden w-auto sm:inline-flex" onClick={openCreate}>
        <Plus className="size-4" aria-hidden />
        {t('actions.add')}
      </Button>
      <Fab label={t('actions.add')} onClick={openCreate} />
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
