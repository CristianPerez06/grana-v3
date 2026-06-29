import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { countPendingSharedRecurrenceInstances } from '@/lib/recurrences/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAccounts } from '@/lib/accounts/queries'
import { getTodayAR, formatDateISO } from '@/lib/date'
import {
  getHousehold,
  getHouseholdDebt,
  getHouseholdOutlook,
  getPendingSettlements,
  getSharedExpenses,
  getSharedAccruedMovements,
} from '@/lib/shared/queries'
import {
  groupSharedSpendingByCategory,
  sharedSpendingTotal,
  sharedReimbursementsTotal,
  sharedOwnNetShare,
} from '@/lib/shared/spending-breakdown'
import type { BalanceCurrency } from '@grana/money-logic'
import { translateCategoryLabel, translateSubcategoryLabel } from '@/lib/categories/display'
import { fmtMoney } from '../_components/money'
import { InviteCard } from '../_components/invite-card'
import { PendingSettlementCard } from '../_components/pending-settlement-card'
import { SpendingBreakdown } from '../_components/spending-breakdown'
import { SettleDrawer } from '../settle/_components/settle-drawer'
import { SetupForm } from '../setup/_components/setup-form'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

// Category colour fallback — mirrors spending-donut.tsx so shared spending reads
// like the rest of the app when a category has no DB colour.
const CAT_FALLBACK = [
  'var(--cat-1)',
  'var(--cat-3)',
  'var(--cat-6)',
  'var(--cat-5)',
  'var(--cat-7)',
  'var(--cat-4)',
  'var(--cat-2)',
]

const currentMonth = (): string => formatDateISO(getTodayAR()).slice(0, 7)
const isValidMonth = (m: string | undefined): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)

const shiftMonth = (ym: string, delta: number): string => {
  const [y, m] = ym.split('-').map(Number)
  const base = (y * 12 + (m - 1) + delta)
  const ny = Math.floor(base / 12)
  const nm = (base % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
// Abbreviated month for the projection axis ("jul", "ago").
const monthShort = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
}

export default async function SharedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
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

  const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? ''
  const partner = household.members.find((m) => m.userId !== userId)
  const partnerName = firstName(partner?.fullName ?? '')

  const sp = await searchParams
  const month = isValidMonth(sp.m) ? sp.m : currentMonth()

  const [debt, expenses, spending, pending, accounts, outlook, pendingSharedRecurrences] =
    await Promise.all([
      getHouseholdDebt(supabase),
      // Registered this month (by date) → "Últimos movimientos".
      getSharedExpenses(supabase, { month }),
      // DEVENGADO: counted by purchase date (cash/card by their date, each cuota in
      // its month) → "Gastaron juntos" + breakdown. The DEBT keeps its own impact
      // clock (getHouseholdDebt/Outlook), so a future card consumo counts as spending
      // this month but only enters the debt when its statement is paid.
      getSharedAccruedMovements(supabase, month),
      getPendingSettlements(supabase),
      getAccounts(supabase),
      getHouseholdOutlook(supabase),
      // Teaser: shared recurrences waiting in the hub (the confirm action lives
      // there, not here — this only points to it).
      countPendingSharedRecurrenceInstances(supabase),
    ])
  const youOweSomething = CURRENCIES.some((c) => {
    const d = debt?.[c]
    return d?.kind === 'owes' && d.from === userId
  })

  // What you owe per currency + your accounts (with balances) → settle drawer.
  const owed: Partial<Record<BalanceCurrency, number>> = {}
  for (const c of CURRENCIES) {
    const d = debt?.[c]
    if (d?.kind === 'owes' && d.from === userId) owed[c] = d.amount
  }
  const settleAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({
    id: a.id,
    name: a.name,
    institutionName: a.institution?.name ?? null,
    balances: a.balances,
  }))

  // ── Month spending (gastaron juntos / tu parte / breakdown) — DEVENGADO ──────
  // `spending` is the accrual-scoped list: household TOTAL per category, both
  // currencies. "Tu parte" derives from each item's own share.
  const monthExpenses = spending.filter((e) => e.kind === 'expense')
  const spendOf = (c: BalanceCurrency) => sharedSpendingTotal(spending, c) // gross
  const reimbOf = (c: BalanceCurrency) => sharedReimbursementsTotal(spending, c)
  const netOf = (c: BalanceCurrency) => spendOf(c) - reimbOf(c)
  const netShareOf = (c: BalanceCurrency) => sharedOwnNetShare(spending, c)

  type Slice = { key: string; label: string; color: string; value: number; pct: number }
  const breakdownOf = (c: BalanceCurrency): Slice[] => {
    const total = spendOf(c)
    if (total <= 0) return []
    return groupSharedSpendingByCategory(spending, c).map((g, i) => ({
      key: g.categoryId ?? 'none',
      label:
        translateCategoryLabel(g.name, g.canonicalName, g.isSystem, tRoot) ?? t('split.shared_label'),
      color: g.color ?? CAT_FALLBACK[i % CAT_FALLBACK.length],
      value: g.value,
      pct: (g.value / total) * 100,
    }))
  }
  const breakdownSlices: Record<BalanceCurrency, Slice[]> = {
    ARS: breakdownOf('ARS'),
    USD: breakdownOf('USD'),
  }
  const breakdownMovements = monthExpenses.map((e) => ({
    id: e.id,
    key: e.categoryId ?? 'none',
    currency: e.currencyCode,
    description: e.description,
    amount: e.amount,
  }))

  // Net balance for member A (you) per currency: positive = in your favour.
  const balanceForYou = (cur: BalanceCurrency): number => {
    const d = debt?.[cur]
    if (!d || d.kind === 'settled') return 0
    return d.to === userId ? d.amount : -d.amount
  }

  // ── Month navigator ────────────────────────────────────────────────────────
  const monthNav = (
    <div className="inline-flex items-center gap-1 self-start rounded-xl border border-border bg-card p-1">
      <Link
        href={`/shared?m=${shiftMonth(month, -1)}`}
        aria-label="Mes anterior"
        className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-border-soft hover:text-text"
      >
        <ChevronLeft size={16} />
      </Link>
      <span className="px-2 text-sm font-extrabold text-text">{monthLabel(month)}</span>
      <Link
        href={`/shared?m=${shiftMonth(month, 1)}`}
        aria-label="Mes siguiente"
        className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-border-soft hover:text-text"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  )

  // ── Hero: Gasto del hogar · NETO (A3). El navegador gobierna SOLO esto (A2). ──
  const heroSection = (
    <article className="bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border p-5 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
          {t('dashboard.household_spend_net', { month: monthLabel(month) })}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold">
          <span className="text-emerald-300">USD</span>
          <span className="tabular-nums text-white">{fmtMoney(netOf('USD'), 'USD')}</span>
          <span className="text-navy-muted">{t('dashboard.net_in_usd')}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:gap-x-8">
        <div>
          <span className="text-[11px] font-semibold text-navy-muted">{t('dashboard.net_cost')}</span>
          <span className="mt-1 block text-[28px] font-black leading-none tabular-nums text-white sm:text-[38px]">
            {fmtMoney(netOf('ARS'), 'ARS')}
          </span>
        </div>
        <div className="text-[12px] font-semibold leading-relaxed text-navy-muted">
          <div className="flex items-center justify-end gap-4">
            <span>{t('dashboard.gross_label')}</span>
            <b className="w-[104px] text-right tabular-nums text-white">{fmtMoney(spendOf('ARS'), 'ARS')}</b>
          </div>
          <div className="flex items-center justify-end gap-4">
            <span>{t('dashboard.reimb_label')}</span>
            <b className="w-[104px] text-right tabular-nums text-emerald-300">
              −{fmtMoney(reimbOf('ARS'), 'ARS')}
            </b>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-navy-muted">
        {t('dashboard.your_net_share', { amount: fmtMoney(netShareOf('ARS'), 'ARS') })}
      </p>
      {netShareOf('USD') > 0.01 && (
        <p className="mt-0.5 text-xs font-semibold text-emerald-300">
          {t('dashboard.your_net_share_usd', { amount: fmtMoney(netShareOf('USD'), 'USD') })}
        </p>
      )}
      <SpendingBreakdown
        slices={breakdownSlices}
        movements={breakdownMovements}
        fallbackLabel={t('split.shared_label')}
      />
    </article>
  )

  // ── Dos tiles: "qué se deben hoy" (avatares J→C) + "lo que se viene" (sparkline)
  const initial = (name: string) => (name.trim()[0] || '?').toUpperCase()
  const youName = household.members.find((m) => m.userId === userId)?.fullName ?? ''
  const arsForYou = balanceForYou('ARS')
  const usdForYou = balanceForYou('USD')
  const arsSettled = Math.abs(arsForYou) < 0.01
  const usdSettled = Math.abs(usdForYou) < 0.01

  const debtTile = (
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
            // Gradient line you→partner with an arrowhead toward the creditor.
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
            triggerClassName="flex-1 justify-center px-4"
          />
        )}
        {/* "Ver el detalle" — siempre el mismo CTA terracota con ícono para todos,
            tenga o no el botón "Saldar" (emerald) al lado. Verde + terracota no chocan. */}
        <Button asChild className="flex-1 justify-center px-4 !bg-[#C2705C] text-white hover:opacity-90">
          <Link href="/shared/cuenta-corriente">🧾 {t('dashboard.current_account_action')}</Link>
        </Button>
      </div>
    </Card>
  )

  // Sparkline of the projected balance (today → upcoming months).
  const sparkline = (values: number[]) => {
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const W = 300
    const H = 72
    const P = 8
    const pts = values.map((v, i) => {
      const x = P + (i / (values.length - 1)) * (W - 2 * P)
      const y = H - P - ((v - min) / range) * (H - 2 * P)
      return [x, y] as const
    })
    const [fx, fy] = pts[0]
    const [lx, ly] = pts[pts.length - 1]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[72px] w-full" aria-hidden>
        <polyline
          points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke="#11B981"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={fx} cy={fy} r={4.5} fill={values[0] < 0 ? '#C2705C' : '#11B981'} />
        <circle cx={lx} cy={ly} r={5} fill="#11B981" />
      </svg>
    )
  }

  const projMonths = outlook ? outlook.ARS.filter((m) => m.items.length > 0) : []
  const projValues = [arsForYou, ...(outlook?.ARS.map((m) => m.cumulativeForA) ?? [])]
  const projectedEnd =
    outlook && outlook.ARS.length ? outlook.ARS[outlook.ARS.length - 1].cumulativeForA : arsForYou
  const nextImpact = projMonths[0]?.items[0]
  const nextImpactMonth = projMonths[0] ? monthShort(projMonths[0].month) : ''

  const projectionTile = (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
          {t('dashboard.upcoming_home')}
        </span>
        <span className="rounded-full bg-slate-soft px-2.5 py-0.5 text-[10px] font-bold text-slate">
          {t('dashboard.projection')}
        </span>
      </div>
      {projMonths.length === 0 ? (
        // Empty state — nada por venir.
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <span className="text-3xl" aria-hidden>
            🌴
          </span>
          <p className="text-sm font-extrabold text-text">{t('dashboard.upcoming_none_title')}</p>
          <p className="text-xs text-text-muted">{t('dashboard.upcoming_none_hint')}</p>
        </div>
      ) : (
        <>
          {nextImpact && (
            <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-800">
              <span className="size-2 rounded-full bg-amber-500" />
              {t('dashboard.next_impact')}: {nextImpact.label}
              {nextImpactMonth ? ` · ${nextImpactMonth}` : ''}
            </div>
          )}
          {projValues.some((v, i) => i > 0 && v !== projValues[0]) && (
            <>
              {sparkline(projValues)}
              <div className="mt-1 flex justify-between px-1 text-[11px] font-bold">
                <span className="text-[#C2705C]">{t('dashboard.today_short')}</span>
                {(outlook?.ARS ?? []).map((mo, i, arr) => (
                  <span key={mo.month} className={i === arr.length - 1 ? 'text-income' : 'text-text-muted'}>
                    {monthShort(mo.month)}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-3 flex items-baseline justify-center gap-2 border-t border-border-soft pt-3">
            <span className={`text-2xl font-black tabular-nums ${projectedEnd >= 0 ? 'text-income' : 'text-expense'}`}>
              {projectedEnd >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(projectedEnd), 'ARS')}
            </span>
            <span className="text-xs text-text-muted">{t('dashboard.projected_balance')}</span>
          </div>
        </>
      )}
    </Card>
  )

  const tilesRow = (
    <div className="grid gap-4 sm:grid-cols-2">
      {debtTile}
      {projectionTile}
    </div>
  )

  // ── Últimos movimientos (MovementRow-like: icon + taxonomy + toned amount) ──
  // Agrupados por fecha (Hoy / Ayer / día), igual que el listado canónico de
  // movimientos (MovementList). Las expenses ya vienen ordenadas desc por date.
  const todayISO = formatDateISO(getTodayAR())
  const yesterdayISO = (() => {
    const [y, m, d] = todayISO.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${dt.getFullYear()}-${mm}-${dd}`
  })()
  const formatGroupDate = (dateStr: string): string => {
    if (dateStr === todayISO) return tRoot('transactions.list.today')
    if (dateStr === yesterdayISO) return tRoot('transactions.list.yesterday')
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }
  const recentGroups = (() => {
    const groups = new Map<string, typeof expenses>()
    for (const e of expenses.slice(0, 8)) {
      const existing = groups.get(e.date) ?? []
      existing.push(e)
      groups.set(e.date, existing)
    }
    return Array.from(groups.entries())
  })()
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
          <div className="flex flex-col">
            {recentGroups.map(([groupDate, groupExpenses], groupIndex) => (
              <section
                key={groupDate}
                className={groupIndex === 0 ? '' : 'border-t border-border-soft pt-3 mt-3'}
              >
                <p className="px-4 pb-2 pt-3 text-[12px] font-extrabold capitalize text-text-muted">
                  {formatGroupDate(groupDate)}
                </p>
                <ul className="flex flex-col divide-y divide-border-soft">
                  {groupExpenses.map((e) => {
                    const categoryLabel = translateCategoryLabel(
                      e.categoryName,
                      e.categoryCanonicalName,
                      e.categoryIsSystem,
                      tRoot,
                    )
                    const subcategoryLabel = translateSubcategoryLabel(
                      e.subcategoryName,
                      e.subcategoryCanonicalName,
                      e.subcategoryIsSystem,
                      tRoot,
                    )
                    const primary = e.description || categoryLabel || t('split.shared_label')
                    const taxonomy =
                      categoryLabel && subcategoryLabel
                        ? `${categoryLabel} › ${subcategoryLabel}`
                        : categoryLabel ?? subcategoryLabel
                    const isReimb = e.kind === 'reimbursement'
                    const received = e.reimbursementState === 'received'
                    const amountTone = isReimb
                      ? received
                        ? 'text-income'
                        : 'text-pending'
                      : 'text-expense'
                    const sign = isReimb ? (received ? '+' : '') : '−'
                    const color = e.categoryColor ?? '#8A94A3'
                    // Headline = the share that matters to you; total below.
                    const youPaid = e.payerId === userId
                    const perspectiveAmount = isReimb
                      ? e.amount
                      : youPaid
                        ? e.amount - e.ownShare
                        : e.ownShare
                    const perspectiveLabel = isReimb
                      ? t('dashboard.reimbursement_label')
                      : youPaid
                        ? t('dashboard.partner_part', { name: partnerName })
                        : t('dashboard.your_part')
                    // Card consumption whose statement falls in a later month: it is
                    // registered now but only impacts (and counts) when paid.
                    const futureImpact =
                      e.kind === 'expense' && e.dueDate != null && e.dueDate.slice(0, 7) > currentMonth()
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/transactions/${e.id}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-xl text-base"
                              style={{ backgroundColor: `${color}1A` }}
                              aria-hidden
                            >
                              {e.categoryIcon ?? '🧾'}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-extrabold leading-tight text-text">
                                  {primary}
                                </span>
                                {e.reimbursementState && (
                                  <span
                                    className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                      e.reimbursementState === 'received'
                                        ? 'bg-green-100 text-green-800'
                                        : e.reimbursementState === 'cancelled'
                                          ? 'bg-muted text-muted-foreground line-through'
                                          : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {tRoot(`transactions.reimbursement.state.${e.reimbursementState}`)}
                                  </span>
                                )}
                                {futureImpact && (
                                  <span className="inline-flex shrink-0 items-center rounded-md bg-slate-soft px-1.5 py-0.5 text-[11px] font-medium text-slate">
                                    {t('dashboard.impacts_in', { month: monthLabel(e.dueDate!.slice(0, 7)) })}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-text-muted">
                                {taxonomy ? `${taxonomy} · ` : ''}
                                {e.payerId === userId
                                  ? t('dashboard.paid_by_you')
                                  : t('dashboard.paid_by', { name: e.payerName })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`block text-[14px] font-extrabold tabular-nums ${amountTone}`}>
                              {sign}
                              {fmtMoney(perspectiveAmount, e.currencyCode)}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              {perspectiveLabel} ·{' '}
                              {t('dashboard.total_label', { amount: fmtMoney(e.amount, e.currencyCode) })}
                            </span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      )}
    </section>
  )

  // Teaser no accionable: avisa de recurrencias compartidas por confirmar y
  // linkea al hub (la acción de confirmar vive solo ahí, no en Compartido).
  const recurrenceTeaser =
    pendingSharedRecurrences > 0 ? (
      <Link
        href="/transactions/recurring"
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Repeat className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold leading-tight text-text">
            {t('dashboard.recurrence_teaser_title', { count: pendingSharedRecurrences })}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-text-muted">
            {t('dashboard.recurrence_teaser_hint')}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-text-soft" aria-hidden />
      </Link>
    ) : null

  const pendingSection =
    pending.length > 0 ? (
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
          {t('settle.pending_title')}
        </h2>
        {pending.map((p) => (
          <PendingSettlementCard key={p.id} settlement={p} accounts={settleAccounts} />
        ))}
      </section>
    ) : null

  // The household name + register CTA + settings icon live in (home)/layout.tsx.
  return (
    <div className="flex flex-col gap-4">
      {monthNav}
      {heroSection}
      {tilesRow}
      {recurrenceTeaser}
      {pendingSection}
      {recentSection}
    </div>
  )
}
