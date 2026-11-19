'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getAccountDetail } from '@/lib/accounts/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { AccountDetailHeader } from './account-detail-header'
import { PendingReimbursementsAccountContainer } from './pending-reimbursements-account-container'
import { MovementFiltersAccountContainer } from './movement-filters-account-container'
import { MovementListAccountContainer } from './movement-list-account-container'
import { CurrencyLensPills } from './currency-lens-pills'
import { useAccountCurrencyLens } from './use-account-currency-lens'

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
  const currencyLens = useAccountCurrencyLens(accountId)

  // Cached by the header; dedupes — used here only to decide whether to show
  // the "agregar moneda" link (depends on the account's currencies set).
  const accountQ = useQuery({
    queryKey: QUERY_KEYS.accountDetail(accountId),
    queryFn: () => getAccountDetail(createClient(), accountId),
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
        {/* One toolbar row: «Movimientos» + ARS | USD on the left, search /
            recurrences / filters + «Agregar» on the right. No month navigator:
            the account reads as one continuous list, like a bank statement;
            a specific stretch is found with «Desde / Hasta» in the filters. On a
            phone the lens drops under the title (not enough width for both). */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <MovementFiltersAccountContainer
            accountId={accountId}
            leading={
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-2 md:gap-x-3">
                <h2 className="text-[15px] font-extrabold leading-tight">
                  {t('headers.movements')}
                </h2>
                {currencyLens.show && currencyLens.lens && (
                  <CurrencyLensPills value={currencyLens.lens} onChange={currencyLens.setLens} />
                )}
              </div>
            }
            trailing={
              // Phone width: just the «+», drawn at 36px like the icons beside it;
              // the `::after` gives back the 44px touch target.
              <Button
                size="sm"
                className="w-auto shrink-0 max-md:relative max-md:h-9 max-md:w-9 max-md:px-0 max-md:after:absolute max-md:after:-inset-1 max-md:after:content-['']"
                disabled={!drawer}
                onClick={() => drawer?.openCreate(accountId)}
                aria-label={t('actions.add_transaction')}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                <span className="max-md:sr-only">{t('actions.add_transaction')}</span>
              </Button>
            }
          />
          <MovementListAccountContainer accountId={accountId} />
        </div>
      </section>
    </>
  )
}
