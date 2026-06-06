'use client'

import { useTranslations } from 'next-intl'
import { Pencil } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { getAccountDetailAction } from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useEditAccountDrawer } from './edit-account-drawer'

type Props = {
  accountId: string
}

/**
 * Account detail header — client-side variant. Fetches the account detail via
 * TanStack so the route's `page.tsx` can stay a thin shell. Renders skeletons
 * for the balances while the query is pending; the back link, avatar and name
 * appear from the first paint.
 *
 * The slot of actions on the right only exposes Edit. Archive / delete /
 * reactivate live in the kebab menu on the row in /accounts (see the accounts
 * spec — "El usuario puede ver la lista de sus cuentas agrupadas por tipo").
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
  const editDrawer = useEditAccountDrawer()

  const accountQ = useQuery({
    queryKey: QUERY_KEYS.accountDetail(accountId),
    queryFn: () => getAccountDetailAction(accountId),
  })

  const account = accountQ.data

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
            <div className="size-9 rounded-lg bg-muted/70 animate-pulse" />
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

        <div className="flex items-center gap-1 flex-shrink-0">
          {editDrawer ? (
            <button
              type="button"
              onClick={editDrawer.openEdit}
              aria-label={t('actions.edit')}
              title={t('actions.edit')}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-border-soft hover:text-foreground transition-colors"
            >
              <Pencil className="size-[17px]" aria-hidden />
            </button>
          ) : (
            <a
              href={`/accounts/${accountId}/edit`}
              aria-label={t('actions.edit')}
              title={t('actions.edit')}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-border-soft hover:text-foreground transition-colors"
            >
              <Pencil className="size-[17px]" aria-hidden />
            </a>
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
    </div>
  )
}
