import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CheckCircle2, Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
        <p className="text-sm text-text-muted">{t('setup.description')}</p>
        <SetupForm />
      </div>
    )
  }

  // Household exists but the partner has not joined → show the invite hint.
  if (household.members.length < 2) {
    return (
      <div className="flex flex-col gap-6 max-w-lg">
        <PageHeader title={household.name} actions={<SettingsLink label={t('settings.title')} />} />
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-sm font-semibold text-text">{t('dashboard.waiting_title')}</p>
          <p className="text-xs text-text-muted">{t('dashboard.waiting_hint')}</p>
          <InviteCard />
        </Card>
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
      <div key={currency} className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-muted">
          {youOwe
            ? t('dashboard.you_owe', { name: partnerName })
            : t('dashboard.you_are_owed', { name: partnerName })}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${youOwe ? 'text-expense' : 'text-income'}`}
        >
          {fmtMoney(d.amount, currency)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={household.name} actions={<SettingsLink label={t('settings.title')} />} />

      {/* Balance — the emotional centerpiece of the module */}
      <Card variant={hasAnyDebt ? 'default' : 'emerald'} className="flex flex-col gap-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
          {t('dashboard.balance_title')}
        </h2>
        {debt && !hasAnyDebt && (
          <div className="flex items-center gap-2 text-emerald-deep">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <span className="text-base font-semibold">{t('dashboard.settled')}</span>
          </div>
        )}
        {debt && hasAnyDebt && (
          <div className="flex flex-col gap-3">{CURRENCIES.map((c) => renderBalance(c, debt[c]))}</div>
        )}
        {youOweSomething && (
          <Button asChild className="mt-1">
            <Link href="/shared/settle">{t('dashboard.settle_action')}</Link>
          </Button>
        )}
      </Card>

      {/* Pending settlements to receive */}
      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
            {t('settle.pending_title')}
          </h2>
          {pending.map((p) => (
            <PendingSettlementCard key={p.id} settlement={p} accounts={myAccounts} />
          ))}
        </section>
      )}

      {/* Recent shared expenses */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
          {t('dashboard.recent_title')}
        </h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-text-muted">{t('dashboard.empty')}</p>
        ) : (
          <Card asChild>
            <ul className="flex flex-col divide-y divide-border-soft">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {e.description || e.categoryName || t('split.shared_label')}
                    </p>
                    <p className="text-xs text-text-muted">
                      {e.kind === 'reimbursement'
                        ? t('dashboard.reimbursement_label')
                        : e.payerId === userId
                          ? t('dashboard.paid_by_you')
                          : t('dashboard.paid_by', { name: e.payerName })}{' '}
                      · {t('dashboard.your_share', { amount: fmtMoney(e.ownShare, e.currencyCode) })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      e.kind === 'reimbursement' ? 'text-income' : 'text-text'
                    }`}
                  >
                    {e.kind === 'reimbursement' ? '+' : ''}
                    {fmtMoney(e.amount, e.currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

/** Settings shortcut in the page header — a quiet icon + label link. */
function SettingsLink({ label }: { label: string }) {
  return (
    <Link
      href="/shared/settings"
      className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
    >
      <Settings2 className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
