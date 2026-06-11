'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/categories/types'
import { CreateSubcategoryButton } from './create-subcategory-button'

/**
 * Chrome de /settings/categories/[id]/subcategories: título + botón "+ Agregar"
 * que abre el drawer de nueva subcategoría. Mismo patrón que `AccountsHeader`:
 * el botón se rendea desde first paint y queda `disabled` hasta que la categoría
 * padre resuelve, en lugar de tapar el header con skeleton.
 */
export const SubcategoriesHeader = () => {
  const params = useParams<{ id: string }>()
  const tCat = useTranslations('settings.categories')
  const [category, setCategory] = useState<Category | null>(null)

  useEffect(() => {
    if (!params?.id) return
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', params.id)
        .single()

      if (cancelled || error || !data) return
      setCategory(data as Category)
    })()

    return () => {
      cancelled = true
    }
  }, [params?.id])

  return (
    <PageHeader
      title={tCat('subcategories.title')}
      actions={<CreateSubcategoryButton categoryId={params.id} disabled={category == null} />}
    />
  )
}
