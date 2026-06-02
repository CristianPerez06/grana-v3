'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <Button
        variant="primary"
        className="w-auto"
        onClick={() => setOpen(true)}
        disabled={accounts.length === 0}
      >
        <Plus className="size-4" aria-hidden />
        {tRec('actions.create')}
      </Button>
      <CreateRecurrenceModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}
