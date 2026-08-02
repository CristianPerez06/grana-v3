'use client'

import { MoreHorizontal } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import type { Subcategory } from '@/lib/categories/types'
import { archiveSubcategory, deleteSubcategory } from '@/app/_actions/categories'
import { invalidateAfterCategoryMutation } from '@/lib/transactions/invalidation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemDestructive,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type SubcategoryWithName = Subcategory & { displayName: string }

type Props = {
  subcategories: SubcategoryWithName[]
}

export const SubcategoryList = ({ subcategories }: Props) => {
  const t = useTranslations('settings.categories.subcategories')
  if (subcategories.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-border bg-card px-[22px] py-[42px] text-center">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card">
      {subcategories.map((sub) => (
        <SubcategoryRow key={sub.id} subcategory={sub} displayName={sub.displayName} />
      ))}
    </div>
  )
}

type RowProps = {
  subcategory: Subcategory
  displayName: string
}

const textActionClass =
  'text-xs font-bold text-text-muted transition-colors hover:text-text disabled:opacity-50'

const SubcategoryRow = ({ subcategory, displayName }: RowProps) => {
  const t = useTranslations('settings.categories')
  // Gate actions on the subcategory's OWN ownership, not the parent category's:
  // a user's custom subcategory under a system category is still theirs to
  // archive/delete; system subcategories (user_id === null) stay read-only.
  const isSystem = subcategory.user_id === null
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      setError(null)
      const result = await archiveSubcategory(subcategory.id)
      if (!result.ok) {
        setError(result.formError ?? t('errors.archive_failed'))
        return
      }
      // The action's revalidatePath only refreshes this route's RSC render —
      // the movement form's selector reads the TanStack catalog.
      invalidateAfterCategoryMutation(qc)
    })
  }

  const handleDelete = () => {
    if (!confirm(t('confirmations.delete_subcategory'))) return
    startTransition(async () => {
      setError(null)
      const result = await deleteSubcategory(subcategory.id)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      invalidateAfterCategoryMutation(qc)
    })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border-soft px-[18px] py-[15px] first:border-t-0">
      <div className="min-w-0">
        <span className="block truncate text-[13px] font-extrabold text-text">{displayName}</span>
        {error && <p className="mt-1 text-xs font-semibold text-negative">{error}</p>}
      </div>

      {!isSystem && (
        <>
          {/* Desktop: inline text actions. */}
          <div className="hidden items-center justify-end gap-3 md:flex">
            <button type="button" onClick={handleArchive} disabled={isPending} className={textActionClass}>
              {t('actions.archive')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs font-bold text-negative transition-colors hover:text-negative/80 disabled:opacity-50"
            >
              {t('actions.delete')}
            </button>
          </div>

          {/* Narrow: compact kebab menu with the same actions. */}
          <div className="flex justify-end md:hidden">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('actions.more')}
                  className="size-9 rounded-[12px] border border-border bg-card text-text-muted hover:bg-border-soft"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={handleArchive} disabled={isPending}>
                  {t('actions.archive')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItemDestructive onSelect={handleDelete} disabled={isPending}>
                  {t('actions.delete')}
                </DropdownMenuItemDestructive>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  )
}
