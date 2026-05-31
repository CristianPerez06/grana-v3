'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import {
  CreateRecurrenceModal,
  type RecurrenceAccount,
} from './create-recurrence-modal'

type Props = {
  accounts: RecurrenceAccount[]
  categories: CategoryWithSubcategories[]
}

// Header action that opens the direct-creation modal. Kept separate from the
// list so the recurring page (a server component) can render it alongside the
// PageHeader while owning data loading.
export const CreateRecurrenceButton = ({ accounts, categories }: Props) => {
  const [open, setOpen] = useState(false)
  const tRec = useTranslations('recurrences')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={accounts.length === 0}
        className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-emerald px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-deep disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        {tRec('actions.create')}
      </button>
      <CreateRecurrenceModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}
