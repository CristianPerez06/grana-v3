import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { BalanceCurrency } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getHousehold, getHouseholdDebt } from '@grana/shared'
import { getAccounts } from '@/lib/accounts/queries'
import { getAppStartDate } from '@/lib/profile/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fmtMoney } from '../../_components/money'
import { SettleDrawer } from '../../settle/_components/settle-drawer'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']
const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? ''
const initial = (name: string) => (name.trim()[0] || '?').toUpperCase()

// "Qué se deben hoy" — the net debt strip. Today-anchored: it does NOT follow
// the header's month navigator, so it stays a server component (refreshed by
// the settle flows' router.refresh()). Own boundary: its failure/streaming is
// independent of the month-scoped sections.
export const DebtSection = async () => {
  const supabase = await createClient()
  const t = await getTranslations('shared')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const [household, debt, accounts, appStartDate] = await Promise.all([
    getHousehold(supabase),
    getHouseholdDebt(supabase),
    getAccounts(supabase),
    getAppStartDate(supabase),
  ])
  if (!household || !debt) return null

  const partner = household.members.find((m) => m.userId !== userId)
  const partnerName = firstName(partner?.fullName ?? '')
  const youName = household.members.find((m) => m.userId === userId)?.fullName ?? ''

  const youOweSomething = CURRENCIES.some((c) => {
    const d = debt[c]
    return d?.kind === 'owes' && d.from === userId
  })
  const owed: Partial<Record<BalanceCurrency, number>> = {}
  for (const c of CURRENCIES) {
    const d = debt[c]
    if (d?.kind === 'owes' && d.from === userId) owed[c] = d.amount
  }
  const settleAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({
    id: a.id,
    name: a.name,
    institutionName: a.institution?.name ?? null,
    balances: a.balances,
    avatar: a.avatar,
  }))

  const balanceForYou = (cur: BalanceCurrency): number => {
    const d = debt[cur]
    if (!d || d.kind === 'settled') return 0
    return d.to === userId ? d.amount : -d.amount
  }
  const arsForYou = balanceForYou('ARS')
  const usdForYou = balanceForYou('USD')
  const arsSettled = Math.abs(arsForYou) < 0.01
  const usdSettled = Math.abs(usdForYou) < 0.01

  return (
    <Card className="flex flex-col p-5">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
        {t('dashboard.debt_today_title')}
      </span>
      <div className="mt-3.5 flex items-center justify-center gap-3.5">
        <span
          className="grid size-[46px] shrink-0 place-items-center rounded-full text-lg font-black text-white"
          style={{ background: '#3A6B8A' }}
        >
          {initial(youName)}
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={`text-[22px] font-black leading-none tabular-nums sm:text-[26px] ${
              arsSettled || arsForYou > 0 ? 'text-income' : 'text-expense'
            }`}
          >
            {arsSettled ? t('dashboard.settled') : fmtMoney(Math.abs(arsForYou), 'ARS')}
          </span>
          {!arsSettled && (
            <span
              className="relative h-[3px] w-16 rounded-full"
              style={{
                background:
                  arsForYou < 0
                    ? 'linear-gradient(90deg,#3A6B8A,#C2705C)'
                    : 'linear-gradient(90deg,#C2705C,#3A6B8A)',
              }}
            >
              <span
                className="absolute top-1/2 size-0 -translate-y-1/2"
                style={
                  arsForYou < 0
                    ? { right: -1, borderLeft: '7px solid #C2705C', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }
                    : { left: -1, borderRight: '7px solid #3A6B8A', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }
                }
              />
            </span>
          )}
        </div>
        <span
          className="grid size-[46px] shrink-0 place-items-center rounded-full text-lg font-black text-white"
          style={{ background: '#C2705C' }}
        >
          {initial(partnerName)}
        </span>
      </div>
      <p className="mt-3 text-center text-[12px] font-bold text-text-muted">
        {arsSettled
          ? t('dashboard.settled')
          : arsForYou > 0
            ? t('dashboard.owes_to', { from: partnerName, to: youName })
            : t('dashboard.owes_to', { from: youName, to: partnerName })}{' '}
        · {t('dashboard.in_pesos')}
      </p>
      <span className="mx-auto mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12.5px] font-bold text-emerald-700">
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide">
          USD
        </span>
        {usdSettled
          ? t('dashboard.settled')
          : `${
              usdForYou > 0
                ? t('dashboard.you_are_owed', { name: partnerName })
                : t('dashboard.you_owe', { name: partnerName })
            } ${fmtMoney(Math.abs(usdForYou), 'USD')}`}
      </span>
      <div className="mt-auto flex items-center gap-2 border-t border-border-soft pt-4">
        {youOweSomething && (
          <SettleDrawer
            owed={owed}
            accounts={settleAccounts}
            partnerName={partnerName}
            appStartDate={appStartDate}
            triggerClassName="flex-1 justify-center px-4"
          />
        )}
        <Button asChild className="flex-1 justify-center px-4 !bg-[#C2705C] text-white hover:opacity-90">
          <Link href="/shared/cuenta-corriente">🧾 {t('dashboard.current_account_action')}</Link>
        </Button>
      </div>
    </Card>
  )
}
