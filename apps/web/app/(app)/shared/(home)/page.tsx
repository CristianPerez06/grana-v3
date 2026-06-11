import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
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
import { translateCategoryLabel } from '@/lib/categories/display'
import { fmtMoney } from '../_components/money'
import { InviteCard } from '../_components/invite-card'
import { PendingSettlementCard } from '../_components/pending-settlement-card'
import { SetupForm } from '../setup/_components/setup-form'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

// Up to two initials from a member's full name for the square avatar. Falls
// back to a dot when the profile has no name yet.
const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '·'

export default async function SharedPage() {
  const t = await getTranslations('shared')
  const tRoot = await getTranslations()
  const supabase = await createClient()
  const household = await getHousehold(supabase)

  if (!household) {
    return (
      <>
        <p className="text-sm text-text-muted">{t('setup.description')}</p>
        <SetupForm />
      </>
    )
  }

  if (household.members.length < 2) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm font-semibold text-text">{t('dashboard.waiting_title')}</p>
        <p className="text-xs text-text-muted">{t('dashboard.waiting_hint')}</p>
        <InviteCard />
      </Card>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const partner = household.members.find((m) => m.userId !== userId)
  const partnerName = partner?.fullName ?? ''

  const [debt, expenses, pending, accounts] = await Promise.all([
    getHouseholdDebt(supabase),
    getSharedExpenses(supabase),
    getPendingSettlements(supabase),
    getAccounts(supabase),
  ])
  const myAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({ id: a.id, name: a.name }))

  const youOweSomething = CURRENCIES.some((c) => {
    const d = debt?.[c]
    return d?.kind === 'owes' && d.from === userId
  })

  const hasAnyDebt = CURRENCIES.some((c) => debt?.[c]?.kind === 'owes')

  // Navy balance hero is the route's primary surface. ARS sits above USD and the
  // two currencies are never merged. A debt you owe reads in white; one owed to
  // you reads in light emerald.
  const renderBalance = (currency: BalanceCurrency, d: PairwiseDebt) => {
    if (d.kind === 'settled') return null
    const youOwe = d.from === userId
    const isUSD = currency === 'USD'
    const size = isUSD ? 'text-[22px]' : 'text-[32px] leading-none'
    const color = youOwe ? (isUSD ? 'text-white/80' : 'text-white') : 'text-emerald-300'
    return (
      <div key={currency} className="flex items-end justify-between gap-3">
        <span className="text-sm font-semibold text-navy-muted">
          {youOwe
            ? t('dashboard.you_owe', { name: partnerName })
            : t('dashboard.you_are_owed', { name: partnerName })}
        </span>
        <span className={`font-black tabular-nums whitespace-nowrap ${size} ${color}`}>
          {fmtMoney(d.amount, currency)}
        </span>
      </div>
    )
  }

  const balanceHero = (
    <article className="bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border flex min-h-[238px] flex-col justify-between p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
      <div className="flex flex-col gap-5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy-muted">
          {t('dashboard.balance_title')}
        </h2>
        {debt && !hasAnyDebt && (
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <span className="text-lg font-bold">{t('dashboard.settled')}</span>
          </div>
        )}
        {debt && hasAnyDebt && (
          <div className="flex flex-col gap-4">{CURRENCIES.map((c) => renderBalance(c, debt[c]))}</div>
        )}
      </div>
      {youOweSomething && (
        <Button asChild className="mt-6 w-auto self-start px-4">
          <Link href="/shared/settle">{t('dashboard.settle_action')}</Link>
        </Button>
      )}
    </article>
  )

  const recentSection = (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
        {t('dashboard.recent_title')}
      </h2>
      {expenses.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-sm text-text-muted">
          {t('dashboard.empty')}
        </Card>
      ) : (
        <Card asChild>
          <ul className="flex flex-col divide-y divide-border-soft">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {e.description ||
                      translateCategoryLabel(
                        e.categoryName,
                        e.categoryCanonicalName,
                        e.categoryIsSystem,
                        tRoot,
                      ) ||
                      t('split.shared_label')}
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
  )

  // Household members (existing data from getHousehold) — partner context next
  // to the balance. The current user reads as "Vos", the other as "Miembro".
  const membersCard = (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
        {t('dashboard.integrantes')}
      </h2>
      <ul className="flex flex-col gap-3">
        {household.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-border-soft text-sm font-bold text-navy">
              {initials(m.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{m.fullName}</p>
              <p className="text-xs text-text-muted">
                {m.userId === userId ? t('dashboard.vos') : t('dashboard.miembro')}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )

  const pendingSection =
    pending.length > 0 ? (
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
          {t('settle.pending_title')}
        </h2>
        {pending.map((p) => (
          <PendingSettlementCard key={p.id} settlement={p} accounts={myAccounts} />
        ))}
      </section>
    ) : null

  // Active household: wide two-column operational layout on desktop (balance +
  // recent in the main column, members + pending settlements in the side
  // column); stacks cleanly on narrow.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {balanceHero}
        {recentSection}
      </div>
      <aside className="flex flex-col gap-4">
        {membersCard}
        {pendingSection}
      </aside>
    </div>
  )
}
