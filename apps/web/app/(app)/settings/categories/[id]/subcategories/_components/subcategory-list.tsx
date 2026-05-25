'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { Subcategory } from '@/lib/categories/types'
import { archiveSubcategory, deleteSubcategory } from '@/app/_actions/categories'

type SubcategoryWithName = Subcategory & { displayName: string }

type Props = {
  subcategories: SubcategoryWithName[]
  categoryId: string
  isSystem: boolean
}

export const SubcategoryList = ({ subcategories, isSystem }: Props) => {
  const t = useTranslations('settings.categories.subcategories')
  if (subcategories.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">
        {t('empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {subcategories.map((sub) => (
        <SubcategoryRow
          key={sub.id}
          subcategory={sub}
          displayName={sub.displayName}
          isSystem={isSystem}
        />
      ))}
    </div>
  )
}

type RowProps = {
  subcategory: Subcategory
  displayName: string
  isSystem: boolean
}

const SubcategoryRow = ({ subcategory, displayName, isSystem }: RowProps) => {
  const t = useTranslations('settings.categories')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      setError(null)
      const result = await archiveSubcategory(subcategory.id)
      if (!result.ok) setError(result.formError ?? t('errors.archive_failed'))
    })
  }

  const handleDelete = () => {
    if (!confirm(t('confirmations.delete_subcategory'))) return
    startTransition(async () => {
      setError(null)
      const result = await deleteSubcategory(subcategory.id)
      if (!result.ok) setError(result.formError ?? t('errors.delete_failed'))
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{displayName}</span>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      {!isSystem && (
        <div className="flex items-center gap-2 flex-shrink-0">
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
        </div>
      )}
    </div>
  )
}
