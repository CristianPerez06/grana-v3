'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { archiveAccount, reactivateAccount, deleteAccount } from '@/app/_actions/accounts'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'
import {
  getAccountDetailAction,
  getAccountMovementsAscendingAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { invalidateAfterAccountMutation } from '@/lib/transactions/invalidation'
import { useEditAccountDrawer } from './edit-account-drawer'

type Props = {
  accountId: string
}

/**
 * Account detail header — client-side variant. Fetches the account detail via
 * TanStack so the route's `page.tsx` can stay a thin shell. Renders skeletons
 * for the balances while the query is pending; the back link, avatar and name
 * appear from the first paint (initial paint shows skeleton avatar/title until
 * data lands).
 *
 * The "Editar" button is gated on the drawer being ready: when the
 * `EditAccountDrawerProvider` has finished mounting (its loader resolved both
 * `account` and `institutions`), the `useEditAccountDrawer()` hook returns a
 * non-null context and the button opens the drawer. Otherwise the button falls
 * back to a plain anchor pointing at the `/edit` route (the no-JS / degraded
 * fallback that the legacy component already supported).
 */
export const AccountDetailHeader = ({ accountId }: Props) => {
  const t = useTranslations('accounts')
  const showCents = useShowCents()
  const router = useRouter()
  const qc = useQueryClient()
  const editDrawer = useEditAccountDrawer()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const accountQ = useQuery({
    queryKey: QUERY_KEYS.accountDetail(accountId),
    queryFn: () => getAccountDetailAction(accountId),
  })

  // The visible-or-not decision for archive vs delete depends on whether the
  // account has any transactions. Read from the cached ascending-history query
  // (the list container hydrates it). If it's not yet in the cache, the actions
  // block shows its own skeleton — same staleness contract as the balances.
  const movementsQ = useQuery({
    queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
    queryFn: () => getAccountMovementsAscendingAction(accountId),
  })

  const account = accountQ.data
  const hasTransactions = (movementsQ.data?.length ?? 0) > 0

  const handleArchive = () => {
    if (!confirm(`${t('confirmations.archive_title')} ${t('confirmations.archive_body')}`)) return
    startTransition(async () => {
      setError(null)
      const result = await archiveAccount(accountId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.archive_failed'))
        return
      }
      invalidateAfterAccountMutation(qc)
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(accountId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.reactivate_failed'))
        return
      }
      invalidateAfterAccountMutation(qc)
    })
  }

  const handleDelete = () => {
    if (!confirm(t('confirmations.delete_body_no_transactions'))) return
    startTransition(async () => {
      setError(null)
      const result = await deleteAccount(accountId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      invalidateAfterAccountMutation(qc)
      router.push('/accounts')
    })
  }

  // First-paint skeleton for avatar + title. The shape mirrors the real header
  // (md avatar + 2-line block) so the layout doesn't jolt when data lands.
  if (!account) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-12 shrink-0 rounded-full bg-muted animate-pulse" />
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="h-6 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-28 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="h-3.5 w-10 rounded bg-muted/70 animate-pulse" />
            <div className="h-3.5 w-14 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>
        <div className="flex items-end gap-6">
          <div className="flex flex-col gap-1">
            <div className="h-9 w-36 rounded bg-muted animate-pulse" />
            <div className="h-3 w-8 rounded bg-muted/70 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-6 w-24 rounded bg-muted animate-pulse" />
            <div className="h-3 w-8 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AccountAvatar {...account.avatar} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{account.name}</h1>
              {!account.is_active && (
                <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                  {t('badges.archived')}
                </span>
              )}
            </div>
            {account.type === 'bank' && account.institution && (
              <p className="mt-1 text-sm text-muted-foreground">{account.institution.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Opens the edit drawer when ready; the /edit page is the fallback
              path while the drawer's data is still loading or failed. */}
          {editDrawer ? (
            <button
              type="button"
              onClick={editDrawer.openEdit}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('actions.edit')}
            </button>
          ) : (
            <a
              href={`/accounts/${accountId}/edit`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('actions.edit')}
            </a>
          )}

          {/* Archive/reactivate/delete needs both `account` (already resolved
              if we got here) and the ascending history to decide which one to
              show. Skeleton block while the history query is pending. */}
          {movementsQ.isPending ? (
            <div className="h-3.5 w-14 rounded bg-muted/70 animate-pulse" aria-busy />
          ) : !account.is_active ? (
            <button
              onClick={handleReactivate}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {t('actions.reactivate')}
            </button>
          ) : hasTransactions ? (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {t('actions.archive')}
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              {t('actions.delete')}
            </button>
          )}
        </div>
      </div>

      {/* Balances — ARS primary, USD secondary */}
      <div className="flex items-end gap-6">
        {hasARS && (
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatARS(balances.ARS, showCents)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ARS</p>
          </div>
        )}
        {hasUSD && (
          <div>
            <p className="text-xl font-semibold tabular-nums text-muted-foreground">
              {formatUSD(balances.USD, showCents)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">USD</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
