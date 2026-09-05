'use client'

import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import type { CategoryScope, CategoryWithSubcategories, CategoryType } from '@/lib/categories/types'
import { archiveCategory, deleteCategory } from '@/app/_actions/categories'
import { invalidateAfterCategoryMutation } from '@/lib/transactions/invalidation'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { EditCategoryForm } from '../[id]/edit/_components/edit-category-form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemDestructive,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Props = {
  category: CategoryWithSubcategories
  displayName: string
  subcategoryCount: number
  scope: CategoryScope
  /** Whether the user belongs to an active household (gates the form's "Es del hogar" control). */
  hasHousehold: boolean
}

const pillClassByType: Record<CategoryType, string> = {
  income: 'bg-emerald-soft text-emerald-deep',
  expense: 'bg-terracotta-soft text-terracotta',
  both: 'bg-border-soft text-text-muted',
}

const textActionClass =
  'text-xs font-bold text-text-muted transition-colors hover:text-text disabled:opacity-50'

export const CategoryRow = ({ category, displayName, subcategoryCount, scope, hasHousehold }: Props) => {
  const t = useTranslations('settings.categories')
  // System rows are read-only; own and household rows carry the same actions —
  // a household category is every member's to edit (RLS 0063 decides who).
  const isSystem = scope === 'system'
  const router = useRouter()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [editInstance, setEditInstance] = useState(0)

  const subcategoriesHref = `/settings/categories/${category.id}/subcategories`

  const openEdit = () => {
    setEditInstance((n) => n + 1)
    setEditOpen(true)
  }

  const handleArchive = () => {
    startTransition(async () => {
      setError(null)
      const result = await archiveCategory(category.id)
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
    if (!confirm(t('confirmations.delete_category'))) return
    startTransition(async () => {
      setError(null)
      const result = await deleteCategory(category.id)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      invalidateAfterCategoryMutation(qc)
    })
  }

  // Subtle tint behind the emoji using the category's own color when present.
  const iconStyle = category.color?.startsWith('#')
    ? { backgroundColor: `${category.color}1a` }
    : undefined

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border-soft px-[18px] py-[15px] first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-border-soft text-xl"
          style={iconStyle}
          aria-hidden
        >
          {category.icon ?? ''}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-extrabold text-text">{displayName}</span>
            <span
              className={cn(
                'inline-flex min-h-[22px] items-center rounded-full px-2 text-[11px] font-extrabold',
                pillClassByType[category.type],
              )}
            >
              {t(`types.${category.type}`)}
            </span>
            {scope === 'household' && (
              <span className="inline-flex min-h-[22px] items-center rounded-full bg-emerald-soft px-2 text-[11px] font-extrabold text-emerald-deep">
                {t('household_badge')}
              </span>
            )}
          </div>
          {subcategoryCount > 0 && (
            <span className="mt-1 block text-[13px] font-medium text-text-muted">
              {t('list.subcategory_count', { count: subcategoryCount })}
            </span>
          )}
          {error && <p className="mt-1 text-xs font-semibold text-negative">{error}</p>}
        </div>
      </div>

      {/* Desktop: inline text actions. */}
      <div className="hidden items-center justify-end gap-3 md:flex">
        <Link
          href={subcategoriesHref}
          className="text-xs font-bold text-slate transition-colors hover:text-slate/80"
        >
          {t('actions.view_subcategories')}
        </Link>
        {!isSystem && (
          <>
            <button type="button" onClick={openEdit} className={textActionClass}>
              {t('actions.edit')}
            </button>
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
          </>
        )}
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
            <DropdownMenuItem onSelect={() => router.push(subcategoriesHref)}>
              {t('actions.view_subcategories')}
            </DropdownMenuItem>
            {!isSystem && (
              <>
                <DropdownMenuItem onSelect={openEdit}>
                  {t('actions.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleArchive} disabled={isPending}>
                  {t('actions.archive')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItemDestructive onSelect={handleDelete} disabled={isPending}>
                  {t('actions.delete')}
                </DropdownMenuItemDestructive>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!isSystem && (
        <Drawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          widthPx={540}
          ariaLabel={t('edit.title')}
        >
          <EditCategoryForm
            key={editInstance}
            category={category}
            hasHousehold={hasHousehold}
            variant="drawer"
            onClose={() => setEditOpen(false)}
            onSuccess={() => setEditOpen(false)}
          />
        </Drawer>
      )}
    </div>
  )
}
