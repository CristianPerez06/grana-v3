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
 * Visual ordering of the /accounts/[id] shell — mirrors the legacy page.tsx:
 * back link → header → pending reimbursements → "agregar moneda" affordance
 * (conditional on account.currencies) → "Movimientos" section title with
 * "+ Agregar transacción" CTA → filters → list.
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
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {`← ${t('title')}`}
        </Link>
      </div>

      <AccountDetailHeader accountId={accountId} />

      <PendingReimbursementsAccountContainer accountId={accountId} />

      {canAddCurrency && accountQ.data && (
        <Link
          href={`/accounts/${accountQ.data.id}/edit`}
          className="self-start text-sm text-primary hover:underline"
        >
          {`+ ${t('actions.addCurrency')}`}
        </Link>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
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
        </div>

        <MovementFiltersAccountContainer accountId={accountId} />

        <MovementListAccountContainer accountId={accountId} />
      </section>
    </div>
  )
}
