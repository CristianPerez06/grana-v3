'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { BalanceCurrency, LedgerChange, LedgerEntry } from '@grana/money-logic'
import { deleteSettlement } from '@/app/_actions/shared'
import type { CurrentAccountData } from '@/lib/shared/queries'
import { fmtMoney } from '../../_components/money'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

const fmtDay = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) // tolerate timestamps
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function CurrentAccountView({ data }: { data: CurrentAccountData }) {
  const t = useTranslations('shared.cuenta_corriente')
  const tSettle = useTranslations('shared.settle')
  const router = useRouter()
  const [currency, setCurrency] = useState<BalanceCurrency>('ARS')
  const [eqOpen, setEqOpen] = useState(true)
  const [openBox, setOpenBox] = useState<number | null>(null)
  const [onlySettlements, setOnlySettlements] = useState(false)
  const [person, setPerson] = useState<'all' | string>('all')
  // Revert a settlement (completed → contraasiento; pending → cancel). Inline confirm.
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null)
  const [isReverting, startRevert] = useTransition()
  const handleRevert = (id: string) =>
    startRevert(async () => {
      await deleteSettlement(id)
      setConfirmRevertId(null)
      router.refresh()
    })

  // First name only — cleaner in labels (the household has two people).
  const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? ''
  const acc = data.byCurrency[currency]
  const youId = data.memberAId
  const partnerId = Object.keys(data.nameById).find((id) => id !== youId) ?? ''
  const partner = firstName(data.nameById[partnerId] ?? data.partnerName)
  const youName = firstName(data.nameById[youId] ?? '')
  const nameOf = (id: string | null) => (id ? firstName(data.nameById[id] ?? '') : '')
  const initial = (name: string) => (name.trim()[0] || '?').toUpperCase()

  // Currency-agnostic ARS/USD compact toggle (the form Segmented is too big).
  const currencyToggle = (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={`rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${
            currency === c ? 'bg-text text-white' : 'text-text-muted hover:text-text'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )

  // ── "Qué cambia" + subtitle + state chip ────────────────────────────────────
  const changeCopy = (e: LedgerEntry): string => {
    // Settlements read by perspective so the wording matches the sign: a payment
    // BY you clears YOUR debt (your balance rises, +), one you receive clears the
    // partner's debt (your balance drops, −). A flat "Reduce el saldo" next to a
    // "+" was contradictory.
    if (e.kind === 'settlement' && e.change === 'reduces_balance') {
      return e.amountForA >= 0
        ? t('change_settles_your_debt')
        : t('change_settles_their_debt', { name: partner })
    }
    const map: Record<LedgerChange, string> = {
      adds_other_share: t('change_adds_other', { name: partner }),
      adds_your_share: t('change_adds_your'),
      reduces_debt: t('change_reduces_debt'),
      reduces_balance: t('change_reduces_balance'),
      restores_amount: t('change_restores'),
    }
    return map[e.change]
  }
  const subtitle = (e: LedgerEntry): string => {
    if (e.kind === 'settlement') {
      if (e.state === 'reversed') return t('reversed_hint')
      if (e.state === 'contra') return t('contra_hint')
      const dir =
        e.payerId === youId
          ? t('settle_you_paid', { name: partner })
          : t('settle_they_paid', { name: partner })
      const hint = e.state === 'pending' ? t('settle_pending_hint', { name: partner }) : t('settle_confirmed_hint')
      return `${dir} · ${hint}`
    }
    if (e.kind === 'reimbursement') {
      return `${t('reimb_received_by', { name: nameOf(e.payerId) })} · ${t('split_5050')}`
    }
    // Expense: "Pagó X · split 50·50".
    return `${t('paid_by', { name: nameOf(e.payerId) })} · ${t('split_5050')}`
  }
  const stateChip = (e: LedgerEntry) => {
    if (e.kind !== 'settlement' || !e.state) return null
    const label =
      e.state === 'completed'
        ? t('state_completed')
        : e.state === 'pending'
          ? t('state_pending')
          : e.state === 'reversed'
            ? t('state_reversed')
            : t('state_contra')
    const cls =
      e.state === 'completed'
        ? 'bg-green-100 text-green-800'
        : e.state === 'pending'
          ? 'bg-amber-100 text-amber-800'
          : e.state === 'reversed'
            ? 'bg-muted text-muted-foreground line-through'
            : 'bg-violet-100 text-violet-800'
    return (
      <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
        {label}
      </span>
    )
  }
  const signed = (n: number, muted = false) => {
    const tone = muted ? 'text-text-muted' : n > 0 ? 'text-income' : n < 0 ? 'text-expense' : 'text-text'
    return (
      <span className={`tabular-nums font-extrabold ${tone}`}>
        {n < 0 ? '−' : n > 0 ? '+' : ''}
        {fmtMoney(Math.abs(n), currency)}
      </span>
    )
  }

  // A pending settlement already zeroes the debt (it counts on send), but it's
  // not done until the receiver confirms — surface that on the saldo card.
  const hasPendingSettlement = (c: BalanceCurrency) =>
    data.byCurrency[c].entries.some((e) => e.kind === 'settlement' && e.state === 'pending')

  // ── Saldo cards (bimoneda — both always visible) ────────────────────────────
  const saldoBig = (() => {
    const a = data.byCurrency.ARS
    const bal = a.equation.balanceForA
    const settled = Math.abs(bal) < 0.01
    const pending = hasPendingSettlement('ARS')
    const youOwe = bal < 0
    const arrowColor = settled ? '#11B981' : youOwe ? '#C2705C' : '#11B981'
    return (
      <Card className="flex flex-col p-6">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-soft">
          {currency === 'ARS' ? t('current_balance') : t('also_in', { currency: 'ARS' })}
        </span>
        <span className="mt-3 text-[40px] font-black leading-none tracking-tight tabular-nums text-text">
          {settled ? t('settled') : fmtMoney(Math.abs(bal), 'ARS')}
        </span>
        {settled && pending ? (
          <span className="mt-2 text-[13px] font-semibold text-amber-700">
            {t('settled_pending', { name: partner })}
          </span>
        ) : (
          <span className="mt-2 text-[13px] font-semibold text-text-muted">
            {settled ? t('settled') : youOwe ? t('in_favor_of', { name: partner }) : t('owed_to_you')} ·{' '}
            {t('in_pesos')}
          </span>
        )}
        {!settled && (
          <div className="mt-5 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-black text-white" style={{ background: '#3A6B8A' }}>
              {initial(youName)}
            </span>
            <span className="relative h-[3px] flex-1 rounded-full" style={{ background: arrowColor }}>
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-extrabold" style={{ color: arrowColor }}>
                {youOwe
                  ? t('owes_label', { from: youName, to: partner, amount: fmtMoney(Math.abs(bal), 'ARS') })
                  : t('owes_label', { from: partner, to: youName, amount: fmtMoney(Math.abs(bal), 'ARS') })}
              </span>
              <span
                className="absolute top-1/2 size-0 -translate-y-1/2"
                style={
                  youOwe
                    ? { right: -1, borderLeft: `8px solid ${arrowColor}`, borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }
                    : { left: -1, borderRight: `8px solid ${arrowColor}`, borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }
                }
              />
            </span>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-black text-white" style={{ background: '#C2705C' }}>
              {initial(partner)}
            </span>
          </div>
        )}
        {!settled && youOwe && (
          <Button asChild className="mt-5 w-full justify-center">
            <Link href="/shared/settle">
              <Send size={16} /> {tSettle('title')}
            </Link>
          </Button>
        )}
      </Card>
    )
  })()

  const saldoUsd = (() => {
    const u = data.byCurrency.USD
    const bal = u.equation.balanceForA
    const settled = Math.abs(bal) < 0.01
    const pending = hasPendingSettlement('USD')
    const youOweUsd = u.debt.kind === 'owes' && u.debt.from === youId
    return (
      <Card className="flex flex-col p-6">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-soft">
          {t('also_in', { currency: 'USD' })}
        </span>
        <span className={`mt-3 text-[30px] font-black leading-none tracking-tight tabular-nums ${settled || bal > 0 ? 'text-income' : 'text-expense'}`}>
          {settled ? t('settled') : `${bal > 0 ? '+' : '−'}${fmtMoney(Math.abs(bal), 'USD')}`}
        </span>
        <p className={`mt-2 text-[12.5px] font-medium leading-relaxed ${settled && pending ? 'text-amber-700' : 'text-text-muted'}`}>
          {settled && pending
            ? t('settled_pending', { name: partner })
            : `${settled ? t('settled') : bal > 0 ? t('owed_to_you') : t('in_favor_of', { name: partner })} — ${t('usd_note')}`}
        </p>
        {youOweUsd && (
          <Button asChild className="mt-auto w-full justify-center">
            <Link href="/shared/settle">
              <Send size={16} /> {tSettle('title')}
            </Link>
          </Button>
        )}
      </Card>
    )
  })()

  // ── Equation (each box drills into the entries that compose it) ──────────────
  const eq = acc.equation
  const boxEntries = (idx: number): LedgerEntry[] => {
    if (idx === 0) return acc.entries.filter((e) => e.kind === 'expense' && e.payerId === youId)
    if (idx === 1) return acc.entries.filter((e) => e.kind === 'expense' && e.payerId !== youId)
    if (idx === 2) return acc.entries.filter((e) => e.kind === 'reimbursement' || e.kind === 'settlement')
    return []
  }
  const eqBox = (idx: number, label: string, value: number, total = false) => {
    const open = openBox === idx
    return (
      <button
        type="button"
        disabled={total}
        onClick={() => setOpenBox(open ? null : idx)}
        className={`rounded-xl border p-3.5 text-left transition-colors ${
          total
            ? 'cursor-default border-green-200 bg-green-50'
            : `cursor-pointer hover:border-text-soft ${open ? 'border-text-soft ring-1 ring-text-soft' : 'border-border'}`
        }`}
      >
        <p className="flex min-h-[34px] items-start justify-between gap-1 text-[12px] font-medium leading-snug text-text-muted">
          <span>{label}</span>
          {!total && (
            <ChevronDown size={13} className={`mt-0.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
        </p>
        <p className="mt-2">{signed(value)}</p>
      </button>
    )
  }

  // ── Extracto (filtered) ─────────────────────────────────────────────────────
  const entries = acc.entries.filter((e) => {
    if (onlySettlements && e.kind !== 'settlement') return false
    if (person !== 'all' && e.payerId !== person) return false
    return true
  })
  const projection = data.outlook?.[currency]?.filter((m) => m.items.length > 0) ?? []

  const GRID = 'grid grid-cols-[58px_minmax(0,1fr)_auto] sm:grid-cols-[64px_minmax(0,1fr)_170px_120px_104px]'

  return (
    <div className="flex flex-col gap-4">
      {/* saldo cards — both currencies always visible */}
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        {saldoBig}
        {saldoUsd}
      </div>

      {/* equation */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold tracking-tight text-text">{t('equation_title')}</span>
          <button
            type="button"
            onClick={() => setEqOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-text-muted"
          >
            {eqOpen ? t('equation_hide') : t('equation_show')}
            <ChevronDown size={14} className={`transition-transform ${eqOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
        {eqOpen && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {eqBox(0, t('eq_other_shares', { name: partner }), eq.otherSharesYouPaid)}
              {eqBox(1, t('eq_your_shares', { name: partner }), eq.yourSharesTheyPaid)}
              {eqBox(2, t('eq_reimb_settle'), eq.reimbursementsAndSettlements)}
              {eqBox(3, t('current_balance'), eq.balanceForA, true)}
            </div>
            {/* drill de la caja seleccionada */}
            {openBox !== null && openBox < 3 && (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                {boxEntries(openBox).length === 0 ? (
                  <p className="py-2 text-center text-[12.5px] text-text-muted">{t('eq_drill_empty')}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border-soft">
                    {boxEntries(openBox).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                        <span className="min-w-0 truncate text-text-muted">
                          <span className="font-bold text-text-soft">{fmtDay(e.date)}</span> · {e.label}
                        </span>
                        <span className="shrink-0">{signed(e.amountForA)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="mt-3.5 text-[12.5px] font-medium text-text-muted">{t('eq_foot')}</p>
          </>
        )}
      </Card>

      {/* toolbar: currency toggle + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {currencyToggle}
        <div className="flex flex-wrap items-center gap-2">
          {/* Persona */}
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 text-xs font-bold">
            {[
              { v: 'all', label: t('filter_all') },
              { v: youId, label: youName },
              { v: partnerId, label: partner },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setPerson(o.v)}
                className={`rounded-full px-2.5 py-1 transition-colors ${person === o.v ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {/* Liquidaciones */}
          <button
            type="button"
            onClick={() => setOnlySettlements((v) => !v)}
            aria-pressed={onlySettlements}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              onlySettlements ? 'border-text bg-text text-white' : 'border-border bg-card text-text-muted hover:text-text'
            }`}
          >
            {t('filter_settlements')}
          </button>
        </div>
      </div>

      {/* extracto */}
      <Card asChild>
        <div className="flex flex-col">
          {/* column headers */}
          <div className={`${GRID} items-center gap-3 border-b border-border-soft px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-soft`}>
            <span>{t('col_date')}</span>
            <span>{t('col_movement')}</span>
            <span className="hidden sm:block">{t('col_change')}</span>
            <span className="hidden text-right sm:block">{t('col_amount')}</span>
            <span className="text-right">{t('col_balance')}</span>
          </div>

          {/* lo que se viene · cómo queda el saldo proyectado (mockup: 1 fila/mes) */}
          {projection.length > 0 && (
            <div className="border-b border-border-soft bg-[#FCFBF8] px-6 py-4">
              <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#B97A1C]">
                {t('upcoming')}
              </p>
              {projection.map((m, i) => {
                const owe = m.cumulativeForA < 0
                const shown = m.items.slice(0, 2).map((it) => it.label).join(' · ')
                const detail =
                  m.items.length > 2
                    ? `${shown} ${t('impacts_more', { count: m.items.length - 2 })}`
                    : shown
                return (
                  <div
                    key={m.month}
                    className={`flex items-center gap-3 py-2 ${i > 0 ? 'border-t border-dashed border-border' : ''}`}
                  >
                    <span className="w-[88px] shrink-0 text-[13.5px] font-extrabold capitalize text-text">
                      {monthLabel(m.month)}
                    </span>
                    <span className={`shrink-0 text-base font-extrabold tabular-nums ${owe ? 'text-expense' : 'text-income'}`}>
                      {owe ? '−' : '+'}
                      {fmtMoney(Math.abs(m.cumulativeForA), currency)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ${
                        owe ? 'bg-[#F7ECE7] text-[#C2705C]' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {owe ? t('in_favor_of', { name: partner }) : t('owed_to_you')}
                    </span>
                    <span className="ml-auto truncate pl-2 text-right text-[11.5px] font-semibold tabular-nums text-text-soft">
                      {t('impacts_detail', {
                        amount: `${m.deltaForA >= 0 ? '+' : '−'}${fmtMoney(Math.abs(m.deltaForA), currency)}`,
                        detail,
                      })}
                    </span>
                  </div>
                )
              })}
              {/* nota: estado de hoy (negrita) + vuelco si lo hay (ámbar) */}
              <p className="mt-3 text-[12px] font-medium leading-relaxed text-text-muted">
                <span className="font-bold text-text">
                  {acc.debt.kind === 'settled'
                    ? t('proj_today_settled')
                    : acc.debt.from === youId
                      ? t('proj_today_owe', { name: partner, amount: fmtMoney(acc.debt.amount, currency) })
                      : t('proj_today_owed', { name: partner, amount: fmtMoney(acc.debt.amount, currency) })}
                </span>{' '}
                {(() => {
                  const todayNeg = acc.equation.balanceForA < 0
                  const flip = projection.find((m) => m.cumulativeForA < 0 !== todayNeg && Math.abs(m.cumulativeForA) > 0.01)
                  return flip ? (
                    <span className="font-extrabold text-[#B97A1C]">
                      {t('proj_flip', { month: monthLabel(flip.month) })}
                    </span>
                  ) : null
                })()}
              </p>
            </div>
          )}

          {/* hoy divider */}
          <div className="flex items-center gap-3 bg-green-50 px-4 py-2.5">
            <span className="h-px flex-1 bg-green-200" />
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-income">
              {t('today_balance', {
                detail:
                  acc.debt.kind === 'settled'
                    ? t('settled')
                    : `${fmtMoney(acc.debt.amount, currency)} ${
                        acc.debt.from === youId ? t('in_favor_of', { name: partner }) : t('owed_to_you')
                      }`,
              })}
            </span>
            <span className="h-px flex-1 bg-green-200" />
          </div>

          {/* entries */}
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className={`${GRID} items-center gap-3 px-4 py-3 ${e.state === 'reversed' ? 'opacity-60' : ''} ${e.state === 'contra' ? 'bg-violet-50/40' : ''} ${e.state === 'pending' ? 'bg-amber-50/40' : ''}`}
                >
                  <span className="text-xs font-bold tabular-nums text-text-soft">{fmtDay(e.date)}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-bold text-text ${e.state === 'reversed' ? 'line-through' : ''}`}>
                        {e.label}
                      </span>
                      {stateChip(e)}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] font-medium text-text-muted">{subtitle(e)}</p>
                    {/* mobile: qué cambia inline */}
                    <p className="mt-0.5 text-[11px] font-semibold text-text-soft sm:hidden">{changeCopy(e)}</p>
                    {/* revertir — solo settlements vivos (completada/pendiente) */}
                    {e.kind === 'settlement' &&
                      (e.state === 'completed' || e.state === 'pending') &&
                      (confirmRevertId === e.id ? (
                        <span className="mt-1 inline-flex items-center gap-2 text-[11px] font-bold">
                          <span className="text-text-muted">{t('revert_confirm')}</span>
                          <button
                            type="button"
                            onClick={() => handleRevert(e.id)}
                            disabled={isReverting}
                            className="text-expense hover:underline disabled:opacity-50"
                          >
                            {t('revert_yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRevertId(null)}
                            className="text-text-muted hover:underline"
                          >
                            {t('revert_no')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevertId(e.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate hover:underline"
                        >
                          <Undo2 size={12} /> {t('revert')}
                        </button>
                      ))}
                  </div>
                  <span className="hidden text-[13px] font-medium text-text-muted sm:block">{changeCopy(e)}</span>
                  <span className="hidden text-right text-sm sm:block">{signed(e.amountForA, e.state === 'pending')}</span>
                  <span className="text-right text-[13px] font-extrabold tabular-nums text-text">
                    {e.runningForA < 0 ? '−' : ''}
                    {fmtMoney(Math.abs(e.runningForA), currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
