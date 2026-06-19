import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
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
} from '@/lib/shared/queries'
import type { BalanceCurrency } from '@grana/money-logic'
import { translateCategoryLabel, translateSubcategoryLabel } from '@/lib/categories/display'
import { fmtMoney } from '../_components/money'
import { InviteCard } from '../_components/invite-card'
import { PendingSettlementCard } from '../_components/pending-settlement-card'
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

  const partner = household.members.find((m) => m.userId !== userId)
  const partnerName = partner?.fullName ?? ''

  const sp = await searchParams
  const month = isValidMonth(sp.m) ? sp.m : currentMonth()

  const [debt, expenses, spending, pending, accounts, outlook] = await Promise.all([
    getHouseholdDebt(supabase),
    // Registered this month (by date) → "Últimos movimientos".
    getSharedExpenses(supabase, { month }),
    // Impacting this month (cash by date, card by statement) → "Gastaron juntos"
    // + breakdown, so a future card consumption doesn't count until it's paid.
    getSharedExpenses(supabase, { impactMonth: month }),
    getPendingSettlements(supabase),
    getAccounts(supabase),
    getHouseholdOutlook(supabase),
  ])
  const myAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({ id: a.id, name: a.name }))

  const youOweSomething = CURRENCIES.some((c) => {
    const d = debt?.[c]
    return d?.kind === 'owes' && d.from === userId
  })

  // ── Month spending (gastaron juntos / tu parte / breakdown) — impact-scoped ─
  const monthExpenses = spending.filter((e) => e.kind === 'expense')
  const spendOf = (c: BalanceCurrency) =>
    monthExpenses.filter((e) => e.currencyCode === c).reduce((a, e) => a + e.amount, 0)
  const shareOf = (c: BalanceCurrency) =>
    monthExpenses.filter((e) => e.currencyCode === c).reduce((a, e) => a + e.ownShare, 0)

  type Slice = { key: string; label: string; color: string; value: number; pct: number }
  const breakdownOf = (c: BalanceCurrency): Slice[] => {
    const total = spendOf(c)
    if (total <= 0) return []
    const byCat = new Map<
      string,
      { name: string | null; canonical: string | null; isSystem: boolean; color: string | null; value: number }
    >()
    for (const e of monthExpenses.filter((e) => e.currencyCode === c)) {
      const key = e.categoryId ?? 'none'
      const cur =
        byCat.get(key) ??
        {
          name: e.categoryName,
          canonical: e.categoryCanonicalName,
          isSystem: e.categoryIsSystem,
          color: e.categoryColor,
          value: 0,
        }
      cur.value += e.amount
      byCat.set(key, cur)
    }
    return [...byCat.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.value - a.value)
      .map((v, i) => ({
        key: v.key,
        label: translateCategoryLabel(v.name, v.canonical, v.isSystem, tRoot) ?? t('split.shared_label'),
        color: v.color ?? CAT_FALLBACK[i % CAT_FALLBACK.length],
        value: v.value,
        pct: (v.value / total) * 100,
      }))
  }
  const arsBreakdown = breakdownOf('ARS')

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

  // ── Navy hero ──────────────────────────────────────────────────────────────
  // USD line — always visible (bimoneda por defecto), even at zero.
  const usdInline = (value: number, owedToYou: boolean | null, note: string) => (
    <span className="mt-2 inline-flex items-center gap-1.5">
      <span className="rounded-full bg-emerald-500/20 px-1.5 py-px text-[10px] font-extrabold text-emerald-300">
        USD
      </span>
      <span
        className={`text-[13px] font-extrabold tabular-nums ${
          owedToYou === null ? 'text-white' : owedToYou ? 'text-emerald-300' : 'text-[#e3a395]'
        }`}
      >
        {fmtMoney(Math.abs(value), 'USD')}
      </span>
      <span className="text-[11.5px] font-semibold text-navy-muted">{note}</span>
    </span>
  )

  const debtMetric = (() => {
    const d = debt?.ARS
    if (!d || d.kind === 'settled') {
      return (
        <>
          <span className="mt-2 block text-[28px] font-black leading-none text-emerald-300">
            {t('dashboard.settled')}
          </span>
        </>
      )
    }
    const youOwe = d.from === userId
    return (
      <>
        <span
          className={`mt-2 block text-[32px] font-black leading-none tabular-nums ${
            youOwe ? 'text-[#e3a395]' : 'text-emerald-300'
          }`}
        >
          {fmtMoney(d.amount, 'ARS')}
        </span>
        <p className="mt-1.5 text-xs font-medium text-navy-muted">
          {youOwe
            ? t('dashboard.you_owe', { name: partnerName })
            : t('dashboard.you_are_owed', { name: partnerName })}
        </p>
      </>
    )
  })()

  const usdDebt = debt?.USD
  const heroSection = (
    <article className="bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Gastaron juntos */}
        <div className="sm:border-r sm:border-navy-border sm:pr-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
            {t('dashboard.spent_together', { month: monthLabel(month) })}
          </p>
          <span className="mt-2 block text-[32px] font-black leading-none tabular-nums text-white">
            {fmtMoney(spendOf('ARS'), 'ARS')}
          </span>
          <p className="mt-1.5 text-xs font-medium text-navy-muted">
            {t('dashboard.your_month_share', { amount: fmtMoney(shareOf('ARS'), 'ARS') })}
          </p>
          {usdInline(spendOf('USD'), null, t('dashboard.in_the_month'))}
        </div>
        {/* Para saldar / balance */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
            {t('dashboard.to_settle')}
          </p>
          {debtMetric}
          {!usdDebt || usdDebt.kind === 'settled'
            ? usdInline(0, null, t('dashboard.settled'))
            : usdInline(
                usdDebt.amount,
                usdDebt.to === userId,
                usdDebt.from === userId
                  ? t('dashboard.you_owe', { name: partnerName })
                  : t('dashboard.you_are_owed', { name: partnerName }),
              )}
          {youOweSomething && (
            <Button asChild className="mt-4 w-auto px-4">
              <Link href="/shared/settle">{t('dashboard.settle_action')}</Link>
            </Button>
          )}
        </div>
      </div>

      {/* En qué gastaron — barrita apilada clickeable */}
      {arsBreakdown.length > 0 && (
        <div className="mt-5 border-t border-navy-border pt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
            {t('dashboard.spent_on')}
          </p>
          <div className="mt-3 flex h-[11px] overflow-hidden rounded-md bg-white/10">
            {arsBreakdown.map((s) => (
              <span key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            {arsBreakdown.map((s) => {
              const movs = monthExpenses.filter(
                (e) => (e.categoryId ?? 'none') === s.key && e.currencyCode === 'ARS',
              )
              return (
                <details key={s.key} className="group">
                  <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <span className="truncate text-[12.5px] font-bold text-white">{s.label}</span>
                    <span className="ml-auto text-[12.5px] font-extrabold tabular-nums text-white">
                      {fmtMoney(s.value, 'ARS')}
                    </span>
                    <span className="w-8 text-right text-[11px] font-semibold text-navy-muted">
                      {Math.round(s.pct)}%
                    </span>
                    <ChevronRight
                      size={13}
                      className="text-navy-muted transition-transform group-open:rotate-90"
                    />
                  </summary>
                  {movs.length > 0 && (
                    <div className="mb-1 ml-[18px] border-l border-navy-border pl-3">
                      {movs.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 py-1 text-[11.5px]"
                        >
                          <span className="truncate text-navy-muted">{m.description || s.label}</span>
                          <span className="shrink-0 font-bold tabular-nums text-white">
                            {fmtMoney(m.amount, 'ARS')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )

  // ── Próximos compromisos — one card; the next 3 months inside. Each month's
  // headline is the cumulative net the balance will stand at by then; the months
  // with movements detail what lands in them. ────────────────────────────────
  const outlookCards = outlook
    ? outlook.ARS.map((row, i) => ({
        month: row.month,
        arsCum: row.cumulativeForA,
        items: row.items,
        usdCum: outlook.USD[i]?.cumulativeForA ?? 0,
      }))
    : []
  const firstWithItems = outlookCards.findIndex((c) => c.items.length > 0)

  const projectionSection =
    outlookCards.length > 0 ? (
      <section>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-3.5">
            <span className="text-sm font-bold text-text">{t('dashboard.upcoming_title')}</span>
            <span className="rounded-full bg-slate-soft px-2.5 py-0.5 text-[11px] font-bold text-slate">
              {t('dashboard.upcoming_count', { count: outlookCards.length })}
            </span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            {outlookCards.map((c, idx) => {
              // A month only carries a "commitment" when something lands in it.
              // Months with no movement show no amount (the running net is the
              // selected month's balance, not a new obligation here).
              const hasMovement = c.items.length > 0
              const owe = c.arsCum < 0
              const head = (
                <div className="flex flex-col gap-1 p-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-text-soft">
                    {monthLabel(c.month)}
                  </span>
                  {hasMovement ? (
                    <>
                      <span
                        className={`text-lg font-extrabold tabular-nums ${
                          owe ? 'text-expense' : 'text-income'
                        }`}
                      >
                        {fmtMoney(Math.abs(c.arsCum), 'ARS')}
                      </span>
                      <span className="text-xs text-text-muted">
                        {owe
                          ? t('dashboard.you_owe', { name: partnerName })
                          : t('dashboard.you_are_owed', { name: partnerName })}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-text-soft">
                      {t('dashboard.upcoming_empty')}
                    </span>
                  )}
                </div>
              )
              if (!hasMovement) {
                return (
                  <div
                    key={c.month}
                    className="overflow-hidden rounded-xl border border-border bg-[#fbfcfd]"
                  >
                    {head}
                  </div>
                )
              }
              return (
                <details
                  key={c.month}
                  open={idx === firstWithItems}
                  className="overflow-hidden rounded-xl border border-border bg-[#fbfcfd]"
                >
                  <summary className="cursor-pointer list-none">{head}</summary>
                  <div className="border-t border-border-soft bg-card px-3 pb-2.5 pt-1.5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-soft">
                      {t('dashboard.enters_this_month')}
                    </p>
                    {c.items.map((it) => {
                      const credit = it.amountForA > 0 // reduces what you owe
                      return (
                        <div
                          key={it.transactionId}
                          className="flex items-center justify-between gap-3 py-1 text-xs"
                        >
                          <span className="truncate text-text-muted">{it.label}</span>
                          <span
                            className={`shrink-0 font-bold tabular-nums ${
                              credit ? 'text-income' : 'text-text'
                            }`}
                          >
                            {credit ? '−' : ''}
                            {fmtMoney(Math.abs(it.amountForA), 'ARS')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        </Card>
      </section>
    ) : null

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
                                {' · '}
                                {t('dashboard.your_share', { amount: fmtMoney(e.ownShare, e.currencyCode) })}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[14px] font-extrabold tabular-nums ${amountTone}`}>
                            {sign}
                            {fmtMoney(e.amount, e.currencyCode)}
                          </span>
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

  // Single focused column (members live in household settings now).
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      {monthNav}
      {heroSection}
      {pendingSection}
      {projectionSection}
      {recentSection}
    </div>
  )
}
