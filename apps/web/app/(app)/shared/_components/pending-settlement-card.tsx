'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, ClipboardCheck, CreditCard } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { assignSettlementAccount } from '@/app/_actions/shared'
import type { PendingSettlement } from '@/lib/shared/types'
import type { BalanceCurrency } from '@grana/money-logic'
import { fmtMoney } from './money'

const ACCENT = ['#E79A2B', '#11B981', '#7C5CD6', '#3A6B8A', '#C95C86']

type SettleAccount = {
  id: string
  name: string
  institutionName?: string | null
  balances: Record<BalanceCurrency, number>
}

type Props = {
  settlement: PendingSettlement
  accounts: SettleAccount[]
}

// Institution leads, the account's own name is the secondary detail (omitted when
// it would just repeat the institution). Mirrors the settle form / accounts list.
const accountPrimaryName = (a: SettleAccount): string => a.institutionName?.trim() || a.name
const accountSecondaryName = (a: SettleAccount): string | null => {
  const inst = a.institutionName?.trim()
  return inst && inst !== a.name ? a.name : null
}

export function PendingSettlementCard({ settlement, accounts }: Props) {
  const t = useTranslations('shared')
  const router = useRouter()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onConfirm = async () => {
    if (!accountId) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await assignSettlementAccount({ settlement_id: settlement.id, account_id: accountId })
      if (!r.ok) {
        setError(r.formError ?? r.fieldErrors?.account_id ?? 'Error')
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const cur = settlement.currencyCode
  const fmt = (n: number) => fmtMoney(n, cur)
  const amountFmt = fmt(settlement.amount)
  const selIdx = Math.max(
    accounts.findIndex((a) => a.id === accountId),
    0,
  )
  const selected = accounts[selIdx] ?? accounts[0]

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning-soft p-4 shadow-sm">
      {/* header — quién pagó + qué hacer */}
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
          <ClipboardCheck size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-text">
            {t('settle.pending_from', { amount: amountFmt, name: settlement.fromName })}
          </p>
          <p className="mt-0.5 text-[12.5px] font-medium text-text-muted">{t('settle.pending_confirm_hint')}</p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* picker de cuenta con saldo (dropdown — compacto) */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-text-muted">{t('settle.receiver_account_label')}</Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors ${
              pickerOpen ? 'border-emerald-500' : 'border-border'
            }`}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: ACCENT[selIdx % ACCENT.length] }}
            >
              <CreditCard size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-text">
                {selected ? accountPrimaryName(selected) : '—'}
              </span>
              <span className="block text-[11.5px] font-semibold text-text-muted">
                {t('settle.balance_label')} {fmt(selected?.balances[cur] ?? 0)}
              </span>
            </span>
            <ChevronDown
              size={16}
              className={`ml-auto shrink-0 text-text-muted transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {pickerOpen && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 rounded-xl border border-border bg-card p-1.5 shadow-[0_18px_44px_-16px_rgba(11,26,43,0.45)]">
              {accounts.map((a, i) => {
                const secondary = accountSecondaryName(a)
                const on = a.id === accountId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAccountId(a.id)
                      setPickerOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      on ? 'bg-emerald-50' : 'hover:bg-muted'
                    }`}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: ACCENT[i % ACCENT.length] }}
                    >
                      <CreditCard size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-text">{accountPrimaryName(a)}</span>
                      {secondary && (
                        <span className="block truncate text-[11.5px] font-semibold text-text-muted">{secondary}</span>
                      )}
                    </span>
                    <span className="ml-auto shrink-0 text-[13px] font-extrabold tabular-nums text-text">
                      {fmt(a.balances[cur])}
                    </span>
                    {on && <Check size={16} className="shrink-0 text-emerald-600" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* impacto */}
      {selected && (
        <p className="text-xs leading-relaxed text-text-muted">
          {t('settle.receiver_impact', { account: accountPrimaryName(selected), amount: amountFmt })}
        </p>
      )}

      <Button type="button" onClick={onConfirm} loading={submitting} disabled={!accountId} className="w-full justify-center">
        <Check size={16} /> {t('settle.receiver_confirm')}
      </Button>
    </div>
  )
}
