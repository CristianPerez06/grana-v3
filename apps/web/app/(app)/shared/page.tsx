import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { getAccounts } from '@/lib/accounts/queries'
import {
  getHousehold,
  getHouseholdDebt,
  getPendingSettlements,
  getSharedExpenses,
} from '@/lib/shared/queries'
import type { BalanceCurrency, PairwiseDebt } from '@grana/money-logic'
import { fmtMoney } from './_components/money'
import { InviteCard } from './_components/invite-card'
import { PendingSettlementCard } from './_components/pending-settlement-card'
import { SetupForm } from './setup/_components/setup-form'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

export default async function SharedPage() {
  const t = await getTranslations('shared')
  const household = await getHousehold()

  // No household yet → create or join, both visible inline.
  if (!household) {
    return (
      <div className="flex flex-col gap-6 max-w-lg">
        <PageHeader title={t('title')} />
        <p className="text-sm text-muted-foreground">{t('setup.description')}</p>
        <SetupForm />
      </div>
    )
  }

  // Household exists but the partner has not joined → show the invite hint.
  if (household.members.length < 2) {
    return (
      <div className="flex flex-col gap-6 max-w-lg">
        <PageHeader
          title={household.name}
          actions={
            <Link href="/shared/settings" className="text-sm text-muted-foreground hover:text-foreground">
              {t('settings.title')}
            </Link>
          }
        />
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">{t('dashboard.waiting_title')}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard.waiting_hint')}</p>
          <InviteCard />
        </section>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const partner = household.members.find((m) => m.userId !== userId)
  const partnerName = partner?.fullName ?? ''

  const [debt, expenses, pending, accounts] = await Promise.all([
    getHouseholdDebt(),
    getSharedExpenses(),
    getPendingSettlements(),
    getAccounts(),
  ])
  const myAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({ id: a.id, name: a.name }))

  const youOweSomething = CURRENCIES.some((c) => {
    const d = debt?.[c]
    return d?.kind === 'owes' && d.from === userId
  })

  const hasAnyDebt = CURRENCIES.some((c) => debt?.[c]?.kind === 'owes')

  const renderBalance = (currency: BalanceCurrency, d: PairwiseDebt) => {
    if (d.kind === 'settled') return null
    const youOwe = d.from === userId
    return (
      <div key={currency} className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          {youOwe
            ? t('dashboard.you_owe', { name: partnerName })
            : t('dashboard.you_are_owed', { name: partnerName })}
        </span>
        <span className={`text-lg font-semibold ${youOwe ? 'text-red-600' : 'text-emerald-600'}`}>
          {fmtMoney(d.amount, currency)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={household.name}
        actions={
          <Link href="/shared/settings" className="text-sm text-muted-foreground hover:text-foreground">
            {t('settings.title')}
          </Link>
        }
      />

      {/* Balance */}
      <section className="rounded-lg border border-border p-4 flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('dashboard.balance_title')}
        </h2>
        {debt && !hasAnyDebt && (
          <p className="text-sm text-muted-foreground">{t('dashboard.settled')}</p>
        )}
        {debt && hasAnyDebt && CURRENCIES.map((c) => renderBalance(c, debt[c]))}
        {youOweSomething && (
          <Link
            href="/shared/settle"
            className="mt-1 inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t('dashboard.settle_action')}
          </Link>
        )}
      </section>

      {/* Pending settlements to receive */}
      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('settle.pending_title')}
          </h2>
          {pending.map((p) => (
            <PendingSettlementCard key={p.id} settlement={p} accounts={myAccounts} />
          ))}
        </section>
      )}

      {/* Recent shared expenses */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('dashboard.recent_title')}
        </h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.description || e.categoryName || t('split.shared_label')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.kind === 'reimbursement'
                      ? t('dashboard.reimbursement_label')
                      : e.payerId === userId
                        ? t('dashboard.paid_by_you')
                        : t('dashboard.paid_by', { name: e.payerName })}{' '}
                    · {t('dashboard.your_share', { amount: fmtMoney(e.ownShare, e.currencyCode) })}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium ${
                    e.kind === 'reimbursement' ? 'text-emerald-600' : ''
                  }`}
                >
                  {e.kind === 'reimbursement' ? '+' : ''}
                  {fmtMoney(e.amount, e.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
