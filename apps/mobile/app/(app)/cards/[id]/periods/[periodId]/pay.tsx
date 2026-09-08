import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getCashAndBankAccounts } from '@grana/accounts'
import { suggestNextPeriodDates } from '@grana/money-logic'
import { getCreditCardDetail, getCardPeriodDetail } from '../../../../../../lib/cards/queries'
import { getTodayAR } from '../../../../../../lib/date'
import { supabase } from '../../../../../../lib/supabase'
import { useT } from '../../../../../../lib/locale-context'
import { FormScreen } from '../../../../../../components/layout/FormScreen'
import { PayCardPeriodSkeleton } from '../../../../../../components/cards/PayCardPeriodSkeleton'
import {
  PayCardPeriodForm,
  type PaymentAccount,
} from '../../../../../../components/cards/PayCardPeriodForm'

/**
 * Pay-statement screen. Assembles the reads (card detail, period detail,
 * cash/bank accounts, next-period projection) and hands them to
 * <PayCardPeriodForm>, which owns the client-side defaults/validation and calls
 * the shared `payCardPeriod`. Only closed/overdue unpaid statements are payable.
 */
export default function PayStatementScreen() {
  const t = useT()
  const router = useRouter()
  const { id, periodId } = useLocalSearchParams<{ id: string; periodId: string }>()

  const query = useQuery({
    queryKey: ['cards', 'pay', periodId] as const,
    queryFn: async () => {
      const [cardDetail, period, accounts] = await Promise.all([
        getCreditCardDetail(id),
        getCardPeriodDetail(periodId),
        getCashAndBankAccounts(supabase),
      ])
      return { cardDetail, period, accounts }
    },
  })

  const cardDetail = query.data?.cardDetail ?? null
  const period = query.data?.period ?? null
  const payable =
    !!period &&
    !period.has_payment &&
    (period.variant === 'cerrado_esperando_pago' || period.variant === 'vencido')

  const props = (() => {
    if (!query.data || !cardDetail || cardDetail.type !== 'credit' || !period || !payable) return null

    const today = getTodayAR()
    // The statement being paid announces the dates of the cycle now running —
    // P(n+1), the first period after the one being paid. Pre-fill its persisted
    // (usually estimated) dates; legacy cards without that row fall back to a
    // projection.
    const runningPeriod = cardDetail.periods.find((p) => p.start_date > period.start_date) ?? null
    const projection = suggestNextPeriodDates(cardDetail.periods, today)
    const runningEndDate = runningPeriod?.end_date ?? projection.suggestedEndDate
    const runningDueDate = runningPeriod?.due_date ?? projection.suggestedDueDate
    const runningIsEstimated = runningPeriod?.is_estimated ?? true

    // Cuentas de débito, por moneda: la deuda en dólares se puede cancelar CON dólares.
    // Espejo exacto del web — las dos listas se arman por separado y sus saldos nunca se
    // comparan entre monedas.
    const eligible = [...query.data.accounts.cash, ...query.data.accounts.bank].filter(
      (a) => a.is_active,
    )
    const withCurrency = (code: 'ARS' | 'USD') =>
      eligible.filter((a) => a.currencies.some((c) => c.currency_code === code && c.is_active))
    const toOption = (code: 'ARS' | 'USD') => (a: (typeof eligible)[number]): PaymentAccount => ({
      id: a.id,
      name: a.name,
      subtitle: a.institution && a.institution.name !== a.name ? a.institution.name : null,
      balance: a.balances[code],
    })

    const debitEligible = withCurrency('ARS')
    const paymentAccounts = debitEligible.map(toOption('ARS'))
    const usdEligible = withCurrency('USD')
    const usdAccounts = usdEligible.map(toOption('USD'))

    // Default to an account of the CARD's own bank; fall back to the first.
    const cardInstitutionId = cardDetail.institution?.id ?? null
    const defaultPaymentAccountId =
      (cardInstitutionId
        ? debitEligible.find((a) => a.institution?.id === cardInstitutionId)?.id
        : undefined) ??
      paymentAccounts[0]?.id ??
      ''
    // En dólares NO se cae a la primera: elegir entre varias cuentas equivalentes por el
    // usuario, para una operación que le mueve dólares, sería arbitrario. Se le pide.
    const usdSameInstitution = cardInstitutionId
      ? usdEligible.find((a) => a.institution?.id === cardInstitutionId)?.id
      : undefined
    const defaultUsdAccountId =
      usdSameInstitution ?? (usdAccounts.length === 1 ? usdAccounts[0].id : '')

    return {
      periodId,
      cardId: id,
      pendingAmountARS: period.pendingAmountARS,
      pendingAmountUSD: period.pendingAmountUSD,
      runningEndDate,
      runningDueDate,
      runningIsEstimated,
      paidPeriodEndDate: period.end_date,
      stampTaxRate: period.stampTaxRate,
      paymentAccounts,
      defaultPaymentAccountId,
      usdAccounts,
      defaultUsdAccountId,
    }
  })()

  return (
    <FormScreen
      title={t('cards.payment.title')}
      backLink={{ href: '/(app)/cards/[id]', label: t('cards.back_label') }}
      onBackPress={() => router.back()}
    >
      {query.isPending ? (
        <PayCardPeriodSkeleton />
      ) : !props ? (
        <View className="rounded-2xl border border-border-soft bg-card p-8">
          <Text className="text-center text-sm text-text-muted">
            {t('cards.period.pending_short')}
          </Text>
        </View>
      ) : (
        <PayCardPeriodForm {...props} />
      )}
    </FormScreen>
  )
}
