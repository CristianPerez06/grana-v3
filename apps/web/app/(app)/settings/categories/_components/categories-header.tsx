'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCategoryButton } from './create-category-button'

/**
 * Chrome del root de /settings/categories. El layout monta este componente en
 * toda ruta bajo /settings/categories/**; solo se renderiza en el root
 * (`/settings/categories`) para evitar el doble-header con los layouts propios
 * de cada sub-ruta (/new, /[id]/edit, /[id]/subcategories, /[id]/subcategories/new).
 */
export const CategoriesHeader = () => {
  const t = useTranslations('settings')
  const tCat = useTranslations('settings.categories')
  const pathname = usePathname()

  if (pathname !== '/settings/categories') return null

  return (
    <PageHeader
      title={tCat('label')}
      description={tCat('description')}
      backLink={{ href: '/settings', label: t('title') }}
      actions={<CreateCategoryButton />}
    />
  )
}
