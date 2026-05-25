'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { archiveCategory, deleteCategory } from '@/app/_actions/categories'

type Props = {
  category: CategoryWithSubcategories
  displayName: string
  subcategoryCount: number
  isSystem: boolean
}

export const CategoryRow = ({ category, displayName, subcategoryCount, isSystem }: Props) => {
  const t = useTranslations('settings.categories')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      setError(null)
      const result = await archiveCategory(category.id)
      if (!result.ok) setError(result.formError ?? t('errors.archive_failed'))
    })
  }

  const handleDelete = () => {
    if (!confirm(t('confirmations.delete_category'))) return
    startTransition(async () => {
      setError(null)
      const result = await deleteCategory(category.id)
      if (!result.ok) setError(result.formError ?? t('errors.delete_failed'))
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {category.icon && (
        <span className="text-xl w-8 text-center flex-shrink-0">{category.icon}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{displayName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {t(`types.${category.type}`)}
          </span>
          {subcategoryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {t('list.subcategory_count', { count: subcategoryCount })}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/settings/categories/${category.id}/subcategories`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('actions.view_subcategories')}
        </Link>
        {!isSystem && (
          <>
            <Link
              href={`/settings/categories/${category.id}/edit`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('actions.edit')}
            </Link>
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {t('actions.archive')}
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              {t('actions.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
