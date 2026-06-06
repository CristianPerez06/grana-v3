'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getAccountDetailAction } from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { AccountDetailHeader } from './account-detail-header'
import { PendingReimbursementsAccountContainer } from './pending-reimbursements-account-container'
import { MovementFiltersAccountContainer } from './movement-filters-account-container'
import { MovementListAccountContainer } from './movement-list-account-container'

type Props = {
  accountId: string
}

/**
 * Visual ordering of the /accounts/[id] shell — peer-card layout:
 *   1. Navy hero card (identity + balances + edit)
 *   2. Pending reimbursements card (conditional)
 *   3. "+ Agregar moneda" pill (conditional)
 *   4. Movimientos card (section header + filters + list)
 */
export function AccountDetailContent({ accountId }: Props) {
  const t = useTranslations('accounts')
  const drawer = useMovementDrawer()

  // Cached by the header; dedupes — used here only to decide whether to show
  // the "agregar moneda" link (depends on the account's currencies set).
  const accountQ = useQuery({
    queryKey: QUERY_KEYS.accountDetail(accountId),
    queryFn: () => getAccountDetailAction(accountId),
  })

  const canAddCurrency = useMemo(() => {
    if (!accountQ.data) return false
    const account = accountQ.data
    const allCurrencyCodes = new Set(account.currencies.map((c) => c.currency_code))
    const inactiveCurrencies = account.currencies.filter((c) => !c.is_active)
    return (
      !allCurrencyCodes.has('ARS') ||
      !allCurrencyCodes.has('USD') ||
      inactiveCurrencies.length > 0
    )
  }, [accountQ.data])

  return (
    <>
      <AccountDetailHeader accountId={accountId} />

      <PendingReimbursementsAccountContainer accountId={accountId} />

      {canAddCurrency && accountQ.data && (
        <Link
          href={`/accounts/${accountQ.data.id}/edit`}
          className="inline-flex h-9 w-fit items-center gap-1.5 self-start rounded-full bg-emerald-soft px-3.5 text-[13px] font-bold text-emerald-deep hover:bg-emerald/15 transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden />
          {t('actions.addCurrency')}
        </Link>
      )}

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4">
          <h2 className="text-[15px] font-extrabold leading-tight">
            {t('headers.movements')}
          </h2>
          <Button
            size="sm"
            className="w-auto"
            disabled={!drawer}
            onClick={() => drawer?.openCreate(accountId)}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            {t('actions.add_transaction')}
          </Button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          <MovementFiltersAccountContainer accountId={accountId} />
          <MovementListAccountContainer accountId={accountId} />
        </div>
      </section>
    </>
  )
}
