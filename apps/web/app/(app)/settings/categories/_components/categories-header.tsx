'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import { getCategoryName } from '@/lib/categories/display'
import type { Category } from '@/lib/categories/types'

/**
 * Header del segmento /settings/categories. Conmuta su PageHeaderProps según la
 * ruta activa (lista, /new, /[id]/edit, /[id]/subcategories, /[id]/subcategories/new).
 *
 * Para las rutas con [id], fetchea client-side el nombre de la categoría usando
 * supabase directo + useState (mismo patrón que AccountsHeader/CardsHeader). Se
 * descartó TanStack Query porque no hay dedup posible: las pages hermanas usan
 * el helper server-side y este header es el único consumer cliente.
 *
 * Mientras `category.name` no resuelve, la descripción muestra un non-breaking
 * space (` `) — sirve de placeholder vacío que preserva la altura de la
 * línea sin reflow del título. Cuando resuelve, se reemplaza por el nombre real
 * (traducido via `getCategoryName` para categorías del sistema).
 */
export const CategoriesHeader = () => {
  const t = useTranslations()
  const tCat = useTranslations('settings.categories')
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const id = params?.id

  const [fetched, setFetched] = useState<Category | null>(null)
  // Only show fetched category if it matches the current route param.
  // When `id` changes, this becomes null automatically until the effect fetches
  // the new one — no synchronous setState in the effect needed.
  const category = fetched && fetched.id === id ? fetched : null

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()
      if (cancelled || error || !data) return
      setFetched(data as Category)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // Non-breaking space (U+00A0) reserves the description line height without
  // showing any visible text, so the title doesn't reflow when category resolves.
  const categoryName = category ? getCategoryName(category, (k) => t(k)) : '\u00A0'
  const categoriesHref = '/settings/categories'
  const subcategoriesHref = id ? `/settings/categories/${id}/subcategories` : null

  if (pathname === categoriesHref) {
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

  if (pathname === '/settings/categories/new') {
    return (
      <PageHeader
        title={tCat('new.title')}
        description={tCat('description')}
        backLink={{ href: categoriesHref, label: tCat('label') }}
      />
    )
  }

  if (id && pathname === `/settings/categories/${id}/edit`) {
    return (
      <PageHeader
        title={tCat('edit.title')}
        description={categoryName}
        backLink={{ href: categoriesHref, label: tCat('label') }}
      />
    )
  }

  if (subcategoriesHref && pathname === subcategoriesHref) {
    return (
      <PageHeader
        title={tCat('subcategories.title')}
        description={categoryName}
        backLink={{ href: categoriesHref, label: tCat('label') }}
        actions={
          <Button asChild className="w-auto">
            <Link href={`${subcategoriesHref}/new`}>
              <Plus className="size-4" aria-hidden />
              {tCat('actions.add')}
            </Link>
          </Button>
        }
      />
    )
  }

  if (subcategoriesHref && pathname === `${subcategoriesHref}/new`) {
    return (
      <PageHeader
        title={tCat('subcategories.new.title')}
        description={categoryName}
        backLink={{ href: subcategoriesHref, label: tCat('subcategories.title') }}
      />
    )
  }

  return null
}
