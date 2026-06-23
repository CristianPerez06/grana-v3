import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AlertTriangle, ArrowUpRight, CreditCard, Repeat } from 'lucide-react-native'
import type { CommittedCurrency, CommittedItem } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { useCommittedOutlook } from '../../lib/dashboard/queries'
import { colors } from '../../lib/colors'
import { Button } from '../ui/Button'
import { CommittedSkeleton } from './CommittedSkeleton'
import { MaskedAmount } from './MaskedAmount'
import { MaskedAmountDisplay } from './MaskedAmountDisplay'

const SWAP_MIN_HEIGHT = 240

// Token mirror for inline icon backgrounds (RN can't read CSS vars).
const NAVY = colors.navy
const TERRACOTTA = '#B56A5A'

// ~44pt effective tap target for the small "ver más" section links.
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

const committedTotal = (c: CommittedCurrency) => c.debt + c.recurringExpense

/** ISO `YYYY-MM-DD` → `dd/mm` for the compact movement rows. */
const ddmm = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

// Splits a single-tag rich phrase ("…<amount></amount>…") so native can inject
// a masked amount node where the web `t.rich` tag renders it.
const splitAmountPhrase = (phrase: string) => {
  const m = phrase.match(/^([\s\S]*)<amount><\/amount>([\s\S]*)$/)
  return { before: m?.[1] ?? phrase, after: m?.[2] ?? '' }
}

// One obligation section: icon + label (+ hint) + per-currency subtotal, then
// its top movements by amount, and a link to the full module. USD shows whenever
// the card has any USD activity (bimoneda por defecto), with ceros when the
// section itself has none — consistent with the total. Mirror of the web Section.
const Section = ({
  icon,
  iconBg,
  label,
  hint,
  ars,
  usd,
  showUsd,
  items,
  onPress,
  linkLabel,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  hint: string
  ars: number
  usd: number
  showUsd: boolean
  items: CommittedItem[]
  onPress: () => void
  linkLabel: string
}) => (
  <View className="mt-4">
    <View className="flex-row items-start gap-2.5 border-b border-border-soft pb-2.5">
      <View
        className="h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </View>
      <Text className="min-w-0 flex-1 pt-0.5 text-[13px] font-bold leading-tight text-text">
        {label}
        <Text className="font-medium text-text-soft"> · {hint}</Text>
      </Text>
      <View className="shrink-0 items-end">
        <MaskedAmount
          amount={ars}
          currency="ARS"
          className="text-[15px] font-extrabold text-text"
        />
        {showUsd && (
          <MaskedAmount
            amount={usd}
            currency="USD"
            showCentsOverride
            className="text-[11px] font-extrabold text-emerald-deep"
          />
        )}
      </View>
    </View>

    {items.length > 0 && (
      <View className="mt-1">
        {items.map((it, i) => (
          <View key={`${it.description}-${it.date}-${i}`} className="flex-row items-center gap-2.5 py-1.5">
            <Text className="w-9 shrink-0 text-[11px] font-bold text-text-soft">{ddmm(it.date)}</Text>
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-medium text-text">
              {it.description || '—'}
            </Text>
            <MaskedAmount
              amount={it.amount}
              currency="ARS"
              className="shrink-0 text-[13px] font-bold text-text"
            />
          </View>
        ))}
      </View>
    )}

    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={LINK_HIT_SLOP}>
      <Text className="mt-1 text-[12px] font-bold text-emerald-deep">{linkLabel} →</Text>
    </Pressable>
  </View>
)

// "Comprometido" (mobile parity) — COMPROMISO lens ("obligaciones pendientes":
// ¿qué tengo que pagar y no pagué?): card debt ("A pagar" + "En curso") +
// recurrences pending confirmation, each as a section with its top movements. A
// "Ya entra" band closes the card when there is recurring income (context, never
// summed). Static "from today": it does NOT follow the month navigator.
export const CommittedSection = () => {
  const t = useT()
  const router = useRouter()
  const query = useCommittedOutlook()
  const data = query.data

  const ars = data?.ARS
  const usd = data?.USD
  const totalArs = ars ? committedTotal(ars) : 0
  const totalUsd = usd ? committedTotal(usd) : 0
  const showUsd = totalUsd > 0
  const hasIncome = ars ? ars.recurringIncome > 0 : false
  const hasOverdue = ars ? ars.overdue > 0 : false
  const net = ars ? ars.recurringIncome - totalArs : 0
  const surplus = net >= 0
  // Prioritize the recurrences detail: if there are pending recurrences, list
  // those; only when there are none do we fall back to listing the card consumos.
  const recurringHasItems = ars ? ars.topRecurring.length > 0 : false

  const isEmpty =
    ars && usd
      ? committedTotal(ars) === 0 &&
        committedTotal(usd) === 0 &&
        ars.recurringIncome === 0 &&
        usd.recurringIncome === 0
      : false

  const overdue = ars ? splitAmountPhrase(t('dashboard.committed.overdue')) : null
  const netPhrase = ars
    ? splitAmountPhrase(
        t(surplus ? 'dashboard.committed.net_surplus' : 'dashboard.committed.net_deficit'),
      )
    : null

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-0.5">
        <Text className="text-lg font-semibold text-text">{t('dashboard.committed.title')}</Text>
        <Text numberOfLines={1} className="text-[12.5px] text-text-soft">
          {t('dashboard.committed.question')}
        </Text>
      </View>

      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {ars && usd ? (
          isEmpty ? (
            <View className="items-center justify-center px-4">
              <Text className="text-center text-sm text-text-muted">
                {t('dashboard.committed.empty')}
              </Text>
            </View>
          ) : (
            <View>
              {/* Total a pagar — label izquierda, monto derecha (ARS grande, USD debajo). */}
              <View className="flex-row items-start justify-between gap-3">
                <Text className="pt-1.5 text-xs font-extrabold uppercase text-text-soft">
                  {t('dashboard.committed.total_label')}
                </Text>
                <View className="items-end">
                  <MaskedAmountDisplay
                    amount={totalArs}
                    currency="ARS"
                    className="text-[30px] font-extrabold text-text"
                    decimalClassName="text-[15px] opacity-55"
                  />
                  {showUsd && (
                    <MaskedAmount
                      amount={totalUsd}
                      currency="USD"
                      showCentsOverride
                      className="mt-1.5 text-[13px] font-extrabold text-emerald-deep"
                    />
                  )}
                </View>
              </View>

              {/* Aviso de vencido — sólo cuando hay deuda con vencimiento pasado. */}
              {hasOverdue && overdue && (
                <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-terracotta-soft px-3 py-2">
                  <AlertTriangle size={15} color={TERRACOTTA} strokeWidth={2.25} />
                  <Text className="flex-1 text-[12px] font-semibold text-terracotta">
                    {overdue.before}
                    <MaskedAmount
                      amount={ars.overdue}
                      currency="ARS"
                      className="font-extrabold text-terracotta"
                    />
                    {overdue.after}
                  </Text>
                </View>
              )}

              <Section
                icon={<CreditCard size={15} color="#FFFFFF" strokeWidth={2.25} />}
                iconBg={NAVY}
                label={t('dashboard.committed.card_label')}
                hint={t('dashboard.committed.card_hint')}
                ars={ars.debt}
                usd={usd.debt}
                showUsd={showUsd}
                items={recurringHasItems ? [] : ars.topCard}
                onPress={() => router.push('/cards')}
                linkLabel={t('dashboard.committed.view_cards')}
              />

              <Section
                icon={<Repeat size={15} color="#FFFFFF" strokeWidth={2.25} />}
                iconBg={TERRACOTTA}
                label={t('dashboard.committed.recurring_label')}
                hint={t('dashboard.committed.recurring_hint')}
                ars={ars.recurringExpense}
                usd={usd.recurringExpense}
                showUsd={showUsd}
                items={ars.topRecurring}
                onPress={() => router.push('/transactions/recurring')}
                linkLabel={t('dashboard.committed.view_recurring')}
              />

              {/* "Ya entra" — ingreso recurrente del mes próximo + cierre neto (contexto). */}
              {hasIncome && netPhrase && (
                <>
                  <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-emerald/40 bg-emerald-soft p-3.5">
                    <View className="h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald">
                      <ArrowUpRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-bold text-emerald-deep">
                        {t('dashboard.committed.income_tile_title')}
                      </Text>
                      <Text numberOfLines={1} className="text-[11px] font-medium text-emerald-deep">
                        {t('dashboard.committed.income_tile_sub')}
                      </Text>
                    </View>
                    <MaskedAmountDisplay
                      amount={ars.recurringIncome}
                      currency="ARS"
                      signPrefix="+"
                      className="text-[16px] font-extrabold text-emerald-deep"
                      decimalClassName="text-[10px] opacity-70"
                    />
                  </View>

                  <View
                    className={`mt-3 rounded-2xl px-4 py-3 ${surplus ? 'bg-emerald-soft' : 'bg-border-soft'}`}
                  >
                    <Text
                      className={`text-[12.5px] font-semibold ${surplus ? 'text-emerald-deep' : 'text-negative'}`}
                    >
                      {netPhrase.before}
                      <MaskedAmountDisplay
                        amount={Math.abs(net)}
                        currency="ARS"
                        signPrefix={surplus ? '+' : undefined}
                        className="font-extrabold"
                        decimalClassName="opacity-70"
                      />
                      {netPhrase.after}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.committed.error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <CommittedSkeleton />
        )}
      </View>
    </View>
  )
}
