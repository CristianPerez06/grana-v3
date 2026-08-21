import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { MovementFormAccount } from '@grana/movement-form'
import type { getAccounts } from '@/lib/accounts/queries'

/**
 * Projection of `getAccounts()` onto the flat account shape every form surface
 * consumes (create drawer, edit context, recurrence-instance account picker).
 *
 * Pure and client-safe on purpose: the caller does the read (server client in an
 * RSC, browser client under TanStack) and passes the result here. It lives in
 * one place because the projection carries real decisions — which currencies
 * count as active, credit balances forced to zero (off-ledger), and the credit
 * avatar resolved from its institution so each card keeps its brand color.
 */
export type GroupedAccounts = Awaited<ReturnType<typeof getAccounts>>

type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

export function toFormAccounts(data: GroupedAccounts): MovementFormAccount[] {
  return [
    ...[...data.cash, ...data.bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      balances: a.balances,
      institutionId: a.institution_id ?? null,
      institutionName: a.institution?.name ?? null,
      avatar: a.avatar,
    })),
    ...data.credit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
      // Credit is off-ledger: it has no available balance to show.
      balances: { ARS: 0, USD: 0 },
      institutionId: c.institution_id ?? null,
      institutionName: c.institution?.name ?? null,
      avatar: resolveAccountAvatar(
        { id: c.id, name: c.name, type: 'credit', color_key: c.color_key, icon_key: c.icon_key },
        c.institution,
      ),
    })),
  ]
}
