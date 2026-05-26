import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { computeRunningBalances, type RunningBalanceRow } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAccountMovements } from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import { MovementList } from '@/lib/transactions/components/movement-list'
import { getRecurrenceLinkedTransactionIds } from '@/lib/recurrences/queries'
import { getTodayAR, formatDateISO } from '@/lib/date'
import { AccountDetailHeader } from './_components/account-detail-header'

type Props = {
  params: Promise<{ id: string }>
}

const AccountDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('accounts')

  const [account, movementsAsc] = await Promise.all([
    getAccountDetail(id),
    getAccountMovements(id),
  ])
  if (!account) notFound()
  if (account.type === 'credit') redirect(`/cards/${id}`)

  // Running balance from the full history (ascending), per currency.
  const initial = {
    ARS: Number(account.currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0),
    USD: Number(account.currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0),
  }
  const runningBalances = computeRunningBalances(movementsAsc as RunningBalanceRow[], id, initial)

  // Display order is most-recent-first.
  const movements = movementsAsc.map(toFinancialMovement).reverse()
  const recurrenceLinkedIds = await getRecurrenceLinkedTransactionIds(movements.map((m) => m.id))

  const inactiveCurrencies = account.currencies.filter((c) => !c.is_active)
  const allCurrencyCodes = new Set(account.currencies.map((c) => c.currency_code))
  const canAddCurrency =
    !allCurrencyCodes.has('ARS') ||
    !allCurrencyCodes.has('USD') ||
    inactiveCurrencies.length > 0

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

      <AccountDetailHeader account={account} hasTransactions={movements.length > 0} />

      {canAddCurrency && (
        <Link
          href={`/accounts/${account.id}/edit`}
          className="self-start text-sm text-primary hover:underline"
        >
          {`+ ${t('actions.addCurrency')}`}
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t('headers.movements')}
          </h2>
          <Link
            href={`/accounts/${account.id}/transactions/new`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {`+ ${t('actions.add_transaction')}`}
          </Link>
        </div>
        <MovementList
          movements={movements}
          perspective={{ kind: 'account', accountId: account.id }}
          todayISO={formatDateISO(getTodayAR())}
          showAccount={false}
          recurrenceLinkedIds={recurrenceLinkedIds}
          runningBalances={runningBalances}
        />
      </section>
    </div>
  )
}

export default AccountDetailPage
