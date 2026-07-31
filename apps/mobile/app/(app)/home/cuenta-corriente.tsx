import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BalanceCurrency, LedgerEntry } from '@grana/money-logic'
import type { CurrentAccountData } from '../../../lib/shared/queries'
import { getCurrentAccount } from '../../../lib/shared/queries'
import { deleteSettlement } from '../../../lib/shared/mutators'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Segmented } from '../../../components/ui/Segmented'
import { SkeletonBlock } from '../../../components/ui/SkeletonBlock'
import { ListCardSkeleton } from '../../../components/shared/HogarSkeleton'
import { useT, type TFn } from '../../../lib/locale-context'
import { fmtMoney } from '../../../components/shared/money'

const signed = (n: number, currency: BalanceCurrency) =>
  `${n >= 0 ? '+' : '−'}${fmtMoney(Math.abs(n), currency)}`

function changeLabel(e: LedgerEntry, partnerName: string, t: TFn): string {
  switch (e.change) {
    case 'adds_other_share':
      return t('shared.cuenta_corriente.change_adds_other', { name: partnerName })
    case 'adds_your_share':
      return t('shared.cuenta_corriente.change_adds_your')
    case 'reduces_debt':
      return t('shared.cuenta_corriente.change_reduces_debt')
    case 'restores_amount':
      return t('shared.cuenta_corriente.change_restores')
    case 'reduces_balance':
      return e.amountForA >= 0
        ? t('shared.cuenta_corriente.change_settles_your_debt')
        : t('shared.cuenta_corriente.change_settles_their_debt', { name: partnerName })
  }
}

function stateLabel(state: LedgerEntry['state'], t: TFn): string | null {
  switch (state) {
    case 'completed':
      return t('shared.cuenta_corriente.state_completed')
    case 'pending':
      return t('shared.cuenta_corriente.state_pending')
    case 'reversed':
      return t('shared.cuenta_corriente.state_reversed')
    case 'contra':
      return t('shared.cuenta_corriente.state_contra')
    default:
      return null
  }
}

export default function CuentaCorrienteScreen() {
  const t = useT()
  const query = useQuery({ queryKey: ['shared', 'current-account'], queryFn: getCurrentAccount })
  const backLink = { href: '/home', label: t('common.back') }

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('shared.cuenta_corriente.title')}
        description={t('shared.cuenta_corriente.subtitle')}
        backLink={backLink}
      />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-16">
        {query.isPending ? (
          <View className="flex-col gap-4">
            <View className="rounded-2xl bg-navy p-5">
              <SkeletonBlock className="h-4 w-24 rounded" />
              <View className="mt-2">
                <SkeletonBlock className="h-7 w-56 rounded" />
              </View>
            </View>
            <ListCardSkeleton rows={5} />
          </View>
        ) : query.data ? (
          <Ledger data={query.data} t={t} />
        ) : (
          <View className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <Text className="text-sm text-text-muted">{t('shared.dashboard.settled')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function Ledger({ data, t }: { data: CurrentAccountData; t: TFn }) {
  const queryClient = useQueryClient()
  const [currency, setCurrency] = useState<BalanceCurrency>('ARS')
  const [eqOpen, setEqOpen] = useState(false)
  const [onlySettlements, setOnlySettlements] = useState(false)
  const [person, setPerson] = useState<'all' | 'you' | 'other'>('all')
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)

  const acc = data.byCurrency[currency]

  const balanceText = () => {
    if (acc.debt.kind === 'settled') return t('shared.cuenta_corriente.settled')
    const youOwe = acc.debt.from === data.memberAId
    const label = youOwe
      ? t('shared.cuenta_corriente.in_favor_of', { name: data.partnerName })
      : t('shared.cuenta_corriente.owed_to_you', { name: data.partnerName })
    return `${label} · ${fmtMoney(acc.debt.amount, currency)}`
  }

  const entries = acc.entries.filter((e) => {
    if (onlySettlements && e.kind !== 'settlement') return false
    if (person === 'you' && e.payerId !== data.memberAId) return false
    if (person === 'other' && (e.payerId === data.memberAId || e.payerId == null)) return false
    return true
  })

  const revert = async (id: string) => {
    setReverting(true)
    try {
      await deleteSettlement(queryClient, id)
      setConfirmRevertId(null)
    } finally {
      setReverting(false)
    }
  }

  const eq = acc.equation

  return (
    <View className="flex-col gap-4">
      <Segmented
        ariaLabel="currency"
        value={currency}
        onValueChange={(v) => setCurrency(v as BalanceCurrency)}
        options={[
          { value: 'ARS', label: 'ARS' },
          { value: 'USD', label: 'USD' },
        ]}
      />

      {/* Balance summary */}
      <View className="flex-col gap-1 rounded-2xl bg-navy p-5">
        <Text className="text-sm text-navy-muted">{t('shared.cuenta_corriente.current_balance')}</Text>
        <Text className="text-2xl font-semibold text-white">{balanceText()}</Text>
      </View>

      {/* Equation */}
      <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
        <Pressable
          className="flex-row items-center justify-between"
          onPress={() => setEqOpen((v) => !v)}
        >
          <Text className="text-sm font-semibold text-text">
            {t('shared.cuenta_corriente.equation_title')}
          </Text>
          <Text className="text-xs text-text-soft">
            {eqOpen
              ? t('shared.cuenta_corriente.equation_hide')
              : t('shared.cuenta_corriente.equation_show')}
          </Text>
        </Pressable>
        {eqOpen && (
          <View className="flex-col gap-1 pt-1">
            <EqRow label={t('shared.cuenta_corriente.eq_other_shares', { name: data.partnerName })} value={signed(eq.otherSharesYouPaid, currency)} />
            <EqRow label={t('shared.cuenta_corriente.eq_your_shares', { name: data.partnerName })} value={signed(-eq.yourSharesTheyPaid, currency)} />
            <EqRow label={t('shared.cuenta_corriente.eq_reimb_settle')} value={signed(eq.reimbursementsAndSettlements, currency)} />
            <View className="mt-1 border-t border-border-soft pt-1">
              <EqRow label={t('shared.cuenta_corriente.current_balance')} value={signed(eq.balanceForA, currency)} bold />
            </View>
          </View>
        )}
      </View>

      {/* Filters */}
      <View className="flex-col gap-2">
        <Segmented
          ariaLabel="person"
          value={person}
          onValueChange={(v) => setPerson(v as 'all' | 'you' | 'other')}
          options={[
            { value: 'all', label: t('shared.cuenta_corriente.filter_all') },
            { value: 'you', label: t('shared.dashboard.vos') },
            { value: 'other', label: data.partnerName },
          ]}
        />
        <Pressable
          onPress={() => setOnlySettlements((v) => !v)}
          className={`self-start rounded-full border px-3 py-1 ${onlySettlements ? 'border-navy bg-navy' : 'border-border-soft bg-card'}`}
        >
          <Text className={`text-xs ${onlySettlements ? 'text-white' : 'text-text-muted'}`}>
            {t('shared.cuenta_corriente.filter_settlements')}
          </Text>
        </Pressable>
      </View>

      {/* Entries */}
      <View className="flex-col gap-3 rounded-2xl border border-border bg-card shadow-sm p-5">
        {entries.length === 0 ? (
          <Text className="text-sm text-text-muted">{t('shared.cuenta_corriente.empty')}</Text>
        ) : (
          entries.map((e) => {
            const chip = stateLabel(e.state, t)
            const canRevert = e.kind === 'settlement' && (e.state === 'completed' || e.state === 'pending')
            return (
              <View key={e.id} className="flex-col gap-1 border-b border-border-soft pb-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 flex-col">
                    <Text className="text-sm font-medium text-text">{e.label}</Text>
                    <Text className="text-xs text-text-muted">
                      {changeLabel(e, data.partnerName, t)}
                      {chip ? ` · ${chip}` : ''}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-semibold text-text">
                      {signed(e.amountForA, currency)}
                    </Text>
                    <Text className="text-xs text-text-soft">
                      {t('shared.cuenta_corriente.col_balance')}: {signed(e.runningForA, currency)}
                    </Text>
                  </View>
                </View>
                {canRevert &&
                  (confirmRevertId === e.id ? (
                    <View className="flex-row items-center gap-3 pt-1">
                      <Text className="text-xs text-text-muted">
                        {t('shared.cuenta_corriente.revert_confirm')}
                      </Text>
                      <Pressable onPress={() => revert(e.id)} disabled={reverting}>
                        <Text className="text-xs font-semibold text-negative">
                          {t('shared.cuenta_corriente.revert_yes')}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => setConfirmRevertId(null)}>
                        <Text className="text-xs text-text-soft">
                          {t('shared.cuenta_corriente.revert_no')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable className="pt-1" onPress={() => setConfirmRevertId(e.id)}>
                      <Text className="text-xs text-text-soft">
                        {t('shared.cuenta_corriente.revert')}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )
          })
        )}
      </View>

      <Text className="px-1 text-xs text-text-soft">{t('shared.cuenta_corriente.usd_note')}</Text>
    </View>
  )
}

function EqRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={`text-sm ${bold ? 'font-semibold text-text' : 'text-text-muted'}`}>
        {label}
      </Text>
      <Text className={`text-sm ${bold ? 'font-semibold text-text' : 'text-text'}`}>{value}</Text>
    </View>
  )
}
