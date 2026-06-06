'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Chrome del root de /settings/categories. El layout monta este componente en
 * toda ruta bajo /settings/categories/**; solo se renderiza en el root
 * (`/settings/categories`) para evitar el doble-header con los layouts propios
 * de cada sub-ruta (/new, /[id]/edit, /[id]/subcategories, /[id]/subcategories/new).
 */
export const CategoriesHeader = () => {
  const tCat = useTranslations('settings.categories')
  const pathname = usePathname()

  if (pathname !== '/settings/categories') return null

  return (
    <PageHeader
      title={tCat('label')}
      description={tCat('description')}
      actions={
        <Button asChild className="w-auto">
          <Link href="/settings/categories/new">
            <Plus className="size-4" aria-hidden />
            {tCat('actions.add')}
          </Link>
        </Button>
      }
    />
  )
}
