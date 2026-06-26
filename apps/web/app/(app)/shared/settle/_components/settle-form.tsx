'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, ChevronDown, Clock, CreditCard, Send } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { checkNegativeBalance, type BalanceCurrency } from '@grana/money-logic'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { registerSettlement } from '@/app/_actions/shared'

const ACCENT = ['#11B981', '#E79A2B', '#7C5CD6', '#3A6B8A', '#C95C86']

type SettleAccount = {
  id: string
  name: string
  institutionName?: string | null
  balances: Record<BalanceCurrency, number>
}

type Props = {
  owed: Partial<Record<BalanceCurrency, number>>
  accounts: SettleAccount[]
  partnerName: string
  /** Called after a successful settle (e.g. to close the drawer). */
  onDone?: () => void
}

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? ''
const accountPrimaryName = (a: SettleAccount): string => a.institutionName?.trim() || a.name
const accountSecondaryName = (a: SettleAccount): string | null => {
  const inst = a.institutionName?.trim()
  return inst && inst !== a.name ? a.name : null
}

export function SettleForm({ owed, accounts, partnerName, onDone }: Props) {
  const t = useTranslations('shared')
  const router = useRouter()
  const partner = firstName(partnerName)

  const currencies = Object.keys(owed) as BalanceCurrency[]
  const [currency, setCurrency] = useState<BalanceCurrency>(currencies[0])
  const [amount, setAmount] = useState(String(owed[currencies[0]] ?? ''))
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Post-submit "Enviado · esperando confirmación" state (the payer's view).
  const [sent, setSent] = useState<{ amount: string; balance: string } | null>(null)

  const onCurrencyChange = (c: BalanceCurrency) => {
    setCurrency(c)
    setAmount(String(owed[c] ?? ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0 || !accountId) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await registerSettlement({ currency_code: currency, amount: parsed, account_id: accountId })
      if (!result.ok) {
        const fieldError = 'fieldErrors' in result ? Object.values(result.fieldErrors ?? {})[0] : undefined
        setError(result.formError ?? fieldError ?? 'Error')
        return
      }
      // Show the "Enviado · esperando confirmación" state instead of closing —
      // the settlement is pending until the receiver confirms the account.
      const fmtNow = (n: number) => (currency === 'ARS' ? formatARS(n) : formatUSD(n))
      const owedAtSubmit = owed[currency] ?? 0
      setSent({ amount: fmtNow(parsed), balance: fmtNow(Math.max(owedAtSubmit - parsed, 0)) })
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const parsedAmount = parseMoneyInput(amount)
  const amt = parsedAmount ?? 0
  const owedNow = owed[currency] ?? 0
  const remaining = Math.max(owedNow - amt, 0)
  const accBal = selectedAccount?.balances[currency] ?? 0
  const accAfter = accBal - amt
  const negative =
    selectedAccount && amt > 0 ? checkNegativeBalance(accBal, amt) : null

  const fmt = (n: number) => (currency === 'ARS' ? formatARS(n) : formatUSD(n))
  const fmtSigned = (n: number) => (n < 0 ? `−${fmt(Math.abs(n))}` : fmt(n))
  const half = Math.round((owedNow / 2) * 100) / 100

  const chipCls = (on: boolean) =>
    `rounded-xl border px-3 py-2 text-center text-[13px] font-extrabold transition-colors ${
      on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border bg-card text-text-muted hover:bg-muted'
    }`

  if (sent) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Clock size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-text">{t('settle.sent_title', { amount: sent.amount })}</p>
            <p className="mt-0.5 text-[12.5px] font-medium text-text-muted">
              {t('settle.sent_waiting', { name: partner })}
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-text-muted">
          {t('settle.sent_note', { name: partner, balance: sent.balance })}
        </p>
        <Button type="button" className="mt-auto" onPress={onDone ?? (() => router.push('/shared'))}>
          {t('settle.sent_done')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      {currencies.length > 1 && (
        <Segmented
          value={currency}
          onValueChange={(c) => onCurrencyChange(c as BalanceCurrency)}
          ariaLabel={t('settle.currency_label')}
          options={currencies.map((c) => ({ value: c, label: c }))}
        />
      )}

      {/* monto protagonista — el número grande ES el input (editable) */}
      <div className="text-center">
        <p className="text-[12.5px] font-semibold text-text-muted">
          {t('settle.you_owe_total', { amount: fmt(owedNow), name: partner })}
        </p>
        <div className="mt-1 flex items-center justify-center gap-1">
          <span className="text-[28px] font-black text-text-soft">$</span>
          <MoneyAmountInput
            value={amount}
            onChange={setAmount}
            aria-label={t('settle.amount_label')}
            className="w-full max-w-[240px] bg-transparent text-center text-[42px] font-black leading-none tracking-tight tabular-nums text-text outline-none"
          />
        </div>
      </div>

      {/* montos rápidos */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAmount(String(owedNow))} className={chipCls(amt === owedNow)}>
          {t('settle.quick_total')}
          <span className="block text-[10px] font-bold opacity-70">{fmt(owedNow)}</span>
        </button>
        <button type="button" onClick={() => setAmount(String(half))} className={chipCls(amt === half)}>
          {t('settle.quick_half')}
          <span className="block text-[10px] font-bold opacity-70">{fmt(half)}</span>
        </button>
      </div>

      {/* pagar desde — picker con saldo por cuenta */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('settle.pay_from')}</Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors ${
              pickerOpen ? 'border-emerald-500' : 'border-border'
            }`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: ACCENT[0] }}>
              <CreditCard size={17} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-text">
                {selectedAccount ? accountPrimaryName(selectedAccount) : '—'}
              </span>
              <span className="block text-[11.5px] font-semibold text-text-muted">
                {t('settle.available', { amount: fmt(accBal) })}
              </span>
            </span>
            <ChevronDown size={16} className={`ml-auto shrink-0 text-text-muted transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 rounded-xl border border-border bg-card p-1.5 shadow-[0_18px_44px_-16px_rgba(11,26,43,0.45)]">
              {accounts.map((a, i) => {
                const secondary = accountSecondaryName(a)
                const sel = a.id === accountId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAccountId(a.id)
                      setPickerOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${sel ? 'bg-emerald-50' : 'hover:bg-muted'}`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: ACCENT[i % ACCENT.length] }}>
                      <CreditCard size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-text">{accountPrimaryName(a)}</span>
                      {secondary && <span className="block truncate text-[11.5px] font-semibold text-text-muted">{secondary}</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-[13px] font-extrabold tabular-nums text-text">{fmt(a.balances[currency])}</span>
                    {sel && <Check size={16} className="shrink-0 text-emerald-600" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* qué pasa al pagar — dos cards (cuenta + deuda), antes→después */}
      {amt > 0 && selectedAccount && (
        <div className="flex flex-col gap-2">
          <Label>{t('settle.what_happens')}</Label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="rounded-[14px] border-[1.5px] border-border p-3.5 text-center">
              <p className="truncate text-[11px] font-bold text-text-muted">{accountPrimaryName(selectedAccount)}</p>
              <p className="mt-1 text-[15px] font-extrabold tabular-nums text-text-soft line-through">{fmt(accBal)}</p>
              <p className={`mt-0.5 text-[20px] font-extrabold tracking-tight tabular-nums ${accAfter < 0 ? 'text-[#C2705C]' : 'text-text'}`}>
                {fmtSigned(accAfter)}
              </p>
            </div>
            <ArrowRight size={20} className="shrink-0 text-text-soft" />
            <div className="rounded-[14px] border-[1.5px] border-border p-3.5 text-center">
              <p className="truncate text-[11px] font-bold text-text-muted">{t('settle.debt_with', { name: partner })}</p>
              <p className="mt-1 text-[15px] font-extrabold tabular-nums text-text-soft line-through">{fmt(owedNow)}</p>
              <p className={`mt-0.5 text-[20px] font-extrabold tracking-tight tabular-nums ${remaining < 0.01 ? 'text-income' : 'text-text'}`}>
                {fmt(remaining)}
              </p>
            </div>
          </div>
        </div>
      )}

      {negative?.negative && <NegativeBalanceNotice projected={negative.projected} currency={currency} />}

      {/* restante */}
      {amt > 0 && (
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold ${
            remaining < 0.01 ? 'bg-green-50 text-green-800' : 'bg-slate-soft text-slate'
          }`}
        >
          <Check size={16} className="shrink-0" />
          <span>
            {remaining < 0.01
              ? t('settle.after_settled', { name: partner })
              : t('settle.after_remaining', { name: partner, amount: fmt(remaining) })}
          </span>
        </div>
      )}

      {/* microcopy — empujado al fondo (con el footer), como el mockup */}
      <p className="mt-auto text-xs leading-relaxed text-text-muted">{t('settle.receiver_info', { name: partner })}</p>

      {/* footer */}
      <div className="flex flex-col gap-2">
        <Button type="submit" loading={submitting} disabled={!accountId || amt <= 0}>
          <Send size={16} /> {t('settle.pay_to', { amount: fmt(amt), name: partner })}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onPress={onDone}>
            {t('settle.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
