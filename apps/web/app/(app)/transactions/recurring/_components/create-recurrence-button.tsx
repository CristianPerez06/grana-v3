'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getAccountsAction,
  getAllCategoriesAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import {
  CreateRecurrenceModal,
  type RecurrenceAccount,
} from './create-recurrence-modal'

const activeCodes = (
  currencies: Array<{ currency_code: string; is_active: boolean }>,
): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

// Header action that opens the direct-creation modal. Self-sufficient: fetches
// its own catalogs via TanStack Query using the canonical keys so the layout can
// mount it without passing data props. Button stays disabled until both catalogs
// resolve (chrome-always-visible pattern, see route-loading-and-errors spec).
export const CreateRecurrenceButton = () => {
  const [open, setOpen] = useState(false)
  const tRec = useTranslations('recurrences')

  const queries = useQueries({
    queries: [
      { queryKey: QUERY_KEYS.accountsList, queryFn: () => getAccountsAction() },
      { queryKey: QUERY_KEYS.categoriesTree, queryFn: () => getAllCategoriesAction() },
    ],
  })

  const [accountsQ, categoriesQ] = queries
  const ready = accountsQ.data !== undefined && categoriesQ.data !== undefined

  const accounts: RecurrenceAccount[] = useMemo(() => {
    if (!accountsQ.data) return []
    const { cash, bank, credit } = accountsQ.data
    return [
      ...[...cash, ...bank].map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as 'cash' | 'bank',
        activeCurrencies: activeCodes(a.currencies),
        avatar: a.avatar,
      })),
      ...credit.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'credit' as const,
        activeCurrencies: activeCodes(c.currencies),
      })),
    ]
  }, [accountsQ.data])

  const categories = categoriesQ.data ?? []

  return (
    <>
      <Button
        variant="primary"
        className="w-auto"
        onClick={() => setOpen(true)}
        disabled={!ready || accounts.length === 0}
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
