'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/categories/types'

/**
 * Chrome de /settings/categories/[id]/subcategories: título + botón "+ Agregar".
 * Mismo patrón que `AccountsHeader` / `CardsHeader`: render sincrónico desde
 * first paint con el botón `disabled` hasta que la data resuelve, en lugar de
 * tapar el header con skeleton.
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
      actions={
        category != null ? (
          <Button asChild className="w-auto">
            <Link href={`/settings/categories/${params.id}/subcategories/new`}>
              <Plus className="size-4" aria-hidden />
              {tCat('actions.add')}
            </Link>
          </Button>
        ) : (
          <Button className="w-auto" disabled>
            <Plus className="size-4" aria-hidden />
            {tCat('actions.add')}
          </Button>
        )
      }
    />
  )
}
