import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  ArrowRight,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import type { ExpenseReimbursementVM, Tone, TransactionAccount } from '@grana/transactions'
import type { MovementSharedInfo } from '../../../lib/shared/queries'
import { useLocale, useT } from '../../../lib/locale-context'
import { useShowCents } from '../../../lib/preferences-context'
import { colors } from '../../../lib/colors'
import { Tile, TileHead, DetailRow } from './primitives'
import { fmtMoney, formatShortDate, paymentMethodDescriptor, toneClasses } from './format'

// Tiles core del detalle — mirror RN de web `detail/tile-*.tsx`. Una sola
// columna; el orden lo arma el orquestador (`MovementDetailView`).

// Badge de color + ícono por tipo de cuenta (mirror del `badgeClass` web).
const ACCOUNT_BADGE: Record<'cash' | 'bank' | 'credit', { bg: string; icon: LucideIcon }> = {
  credit: { bg: 'bg-warning', icon: CreditCard },
  bank: { bg: 'bg-slate', icon: Landmark },
  cash: { bg: 'bg-warning', icon: Wallet },
}

type AccountLike = TransactionAccount | null | undefined

// ── Pagado con ───────────────────────────────────────────────────────────────

export const TilePaymentMethod = ({
  account,
  eyebrow,
  meta,
}: {
  account: AccountLike
  eyebrow?: string
  /** Optional bottom meta row (icon + text) with a top divider. */
  meta?: ReactNode
}) => {
  const t = useT()
  const d = paymentMethodDescriptor(account)
  if (!d) return null
  const badge = ACCOUNT_BADGE[d.subKey]
  const Icon = badge.icon

  return (
    <Tile>
      <TileHead eyebrow={eyebrow ?? t('transactions.detail.groups.paid_with')} />
      <View className="flex-row items-center gap-3.5">
        <View className={`h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${badge.bg}`}>
          <Icon size={24} strokeWidth={2} color={colors.white} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16.5px] font-extrabold text-text">{d.name}</Text>
          <Text className="mt-0.5 text-[13px] font-semibold text-text-muted">
            {d.secondary ?? t(`transactions.detail.payment_sub.${d.subKey}`)}
          </Text>
        </View>
      </View>
      {meta != null && (
        <View className="mt-4 flex-row items-center gap-2 border-t border-border pt-3.5">{meta}</View>
      )}
    </Tile>
  )
}

// ── Movimiento de dinero (transferencia / cambio) ────────────────────────────

const FlowNode = ({
  account,
  badgeBg,
  kindLabel,
  subLabel,
}: {
  account: AccountLike
  badgeBg: string
  kindLabel: string
  subLabel: string
}) => {
  const d = paymentMethodDescriptor(account)
  const Icon = d ? ACCOUNT_BADGE[d.subKey].icon : ArrowRight
  return (
    <View className="w-full flex-row items-center gap-3 rounded-2xl border border-border p-4">
      <View className={`h-11 w-11 shrink-0 items-center justify-center rounded-xl ${badgeBg}`}>
        <Icon size={21} strokeWidth={2} color={colors.white} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-muted">
          {kindLabel}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[14px] font-extrabold text-text">
          {d?.name ?? account?.name ?? '—'}
        </Text>
        <Text className="mt-px text-[12px] font-semibold text-text-muted">{subLabel}</Text>
      </View>
    </View>
  )
}

export const TileTransferFlow = ({
  source,
  destination,
}: {
  source: AccountLike
  destination: AccountLike
}) => {
  const t = useT()
  const subFor = (a: AccountLike) => {
    const d = paymentMethodDescriptor(a)
    return d ? (d.secondary ?? t(`transactions.detail.payment_sub.${d.subKey}`)) : ''
  }
  return (
    <Tile>
      <TileHead eyebrow={t('transactions.detail.transfer.flow')} />
      <View className="flex-col items-center gap-2.5">
        <FlowNode
          account={source}
          badgeBg="bg-slate"
          kindLabel={t('transactions.detail.transfer.from')}
          subLabel={subFor(source)}
        />
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-soft">
          <ArrowRight size={20} strokeWidth={2.4} color={colors.slate} />
        </View>
        <FlowNode
          account={destination}
          badgeBg="bg-emerald"
          kindLabel={t('transactions.detail.transfer.to')}
          subLabel={subFor(destination)}
        />
      </View>
    </Tile>
  )
}

export const TileTransferCallout = () => {
  const t = useT()
  return (
    <Tile>
      <View className="rounded-xl bg-slate-soft px-4 py-3">
        <Text className="text-[13.5px] font-bold text-text">
          {t('transactions.detail.transfer.callout_title')}
        </Text>
        <Text className="mt-1 text-[13px] font-medium text-text-muted">
          {t('transactions.detail.transfer.callout_body')}
        </Text>
      </View>
    </Tile>
  )
}

// ── En cuotas ────────────────────────────────────────────────────────────────

type InstallmentChild = { id: string; amount: number; status: 'pending' | 'paid' | null; date: string; installment_n: number | null }

export const TileInstallments = ({
  childrenRows,
  parentAmount,
  currency,
  currentN,
  tone,
}: {
  childrenRows: InstallmentChild[]
  parentAmount: number
  currency: 'ARS' | 'USD'
  currentN: number | null
  tone: Tone
}) => {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  if (!childrenRows.length) return null

  const total = childrenRows.length
  const sorted = [...childrenRows].sort((a, b) => (a.installment_n ?? 0) - (b.installment_n ?? 0))
  const paidCount = sorted.filter((c) => c.status === 'paid').length
  const perInstallment = sorted[0]?.amount ?? parentAmount / total
  const paidAmount = perInstallment * paidCount
  const remainingAmount = Math.max(0, parentAmount - paidAmount)
  const nextChild = sorted.find((c) => c.status !== 'paid')
  const lastChild = sorted[sorted.length - 1]
  const activeN = currentN ?? (paidCount > 0 ? paidCount : 1)
  const fill = toneClasses(tone).fill

  return (
    <Tile>
      <TileHead
        eyebrow={t('transactions.detail.installments.eyebrow')}
        aside={t('transactions.detail.installments.per_month', {
          amount: fmtMoney(perInstallment, currency, showCents),
        })}
      />
      <Text className="text-[24px] font-extrabold tabular-nums text-text">
        {t('transactions.detail.installments.current', { n: activeN })}{' '}
        <Text className="text-[15px] font-bold text-text-muted">
          {t('transactions.detail.installments.of', { total })}
        </Text>
      </Text>

      <View className="my-3.5 flex-row gap-1.5">
        {sorted.map((c) => {
          const isPaid = c.status === 'paid'
          const isCurrent = c.installment_n === activeN
          return (
            <View
              key={c.id}
              className={`h-[9px] flex-1 rounded-full ${isPaid || isCurrent ? fill : 'bg-border-soft'}`}
              style={!isPaid && isCurrent ? { opacity: 0.4 } : undefined}
            />
          )
        })}
      </View>

      <View className="flex-row justify-between">
        <Text className="text-[13px] font-semibold text-text-muted">
          <Text className="font-bold tabular-nums text-text">
            {fmtMoney(paidAmount, currency, showCents)}
          </Text>{' '}
          {t('transactions.detail.installments.paid')}
        </Text>
        <Text className="text-[13px] font-semibold tabular-nums text-text-muted">
          {t('transactions.detail.installments.remaining', {
            amount: fmtMoney(remainingAmount, currency, showCents),
          })}
        </Text>
      </View>

      {(nextChild || lastChild) && (
        <View className="mt-4 flex-row items-center gap-2 border-t border-border pt-3.5">
          <Clock size={15} strokeWidth={2} color={colors.slate} />
          {nextChild ? (
            <Text className="text-[13.5px] font-semibold text-text-muted">
              {t('transactions.detail.installments.next')}:{' '}
              <Text className="font-bold text-text">{formatShortDate(nextChild.date, locale)}</Text>
              {lastChild ? (
                <Text>
                  {' · '}
                  {t('transactions.detail.installments.ends')}{' '}
                  <Text className="font-bold text-text">{formatShortDate(lastChild.date, locale)}</Text>
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text className="text-[13.5px] font-semibold text-text-muted">
              {t('transactions.detail.installments.completed')}
            </Text>
          )}
        </View>
      )}
    </Tile>
  )
}

// ── Resultado neto (gasto con reintegro) ─────────────────────────────────────

export const TileReimbursementNet = ({
  paid,
  currency,
  reimbursements,
}: {
  paid: number
  currency: 'ARS' | 'USD'
  reimbursements: ExpenseReimbursementVM[]
}) => {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const router = useRouter()

  const received = reimbursements.filter((r) => r.state === 'received')
  const reimbursed = received.reduce((sum, r) => sum + r.amount, 0)
  const net = paid - reimbursed

  const parts: { key: string; label: string; value: string; cls: string }[] = [
    { key: 'paid', label: t('transactions.detail.reimbursement_net.paid'), value: `−${fmtMoney(paid, currency, showCents)}`, cls: 'text-negative' },
    { key: 'reimbursed', label: t('transactions.detail.reimbursement_net.reimbursed'), value: `+${fmtMoney(reimbursed, currency, showCents)}`, cls: 'text-positive' },
    { key: 'net', label: t('transactions.detail.reimbursement_net.net'), value: `−${fmtMoney(net, currency, showCents)}`, cls: 'text-text' },
  ]
  const ops = ['+', '=']

  return (
    <Tile>
      <TileHead
        eyebrow={t('transactions.detail.reimbursement_net.eyebrow')}
        aside={t('transactions.detail.reimbursement_net.caption')}
        asideMuted
      />
      <View className="flex-col gap-2">
        {parts.map((p, i) => (
          <View key={p.key}>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
                {p.label}
              </Text>
              <Text className={`text-[20px] font-extrabold tabular-nums ${p.cls}`}>{p.value}</Text>
            </View>
            {i < ops.length && (
              <Text className="py-0.5 text-center text-[15px] font-bold text-text-soft">{ops[i]}</Text>
            )}
          </View>
        ))}
      </View>

      <View className="mt-4 flex-col gap-2">
        {reimbursements.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/transactions/${r.id}`)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl bg-emerald-soft px-3.5 py-3"
          >
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald">
              <FileText size={18} strokeWidth={2} color={colors.white} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[12px] font-bold uppercase tracking-[0.05em] text-emerald-deep">
                {t('transactions.detail.reimbursement_net.linked')}
              </Text>
              <Text className="mt-px text-[13.5px] font-semibold text-text">
                {t(`transactions.reimbursement.state.${r.state}`)}
              </Text>
              <Text className="text-[12.5px] font-medium text-text-muted">
                {formatShortDate(r.date, locale)}
              </Text>
            </View>
            <Text className="shrink-0 text-[16px] font-extrabold tabular-nums text-emerald-deep">
              {`+${fmtMoney(r.amount, r.currencyCode, showCents)}`}
            </Text>
            <ChevronRight size={18} strokeWidth={2.2} color={colors.emeraldDeep} />
          </Pressable>
        ))}
      </View>
    </Tile>
  )
}

// ── Gasto compartido ─────────────────────────────────────────────────────────

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '—'

export const TileShareYours = ({
  shared,
  total,
  currency,
  tone,
}: {
  shared: MovementSharedInfo
  total: number
  currency: 'ARS' | 'USD'
  tone: Tone
}) => {
  const t = useT()
  const showCents = useShowCents()
  return (
    <Tile>
      <TileHead eyebrow={t('transactions.detail.shared.your_share')} />
      <Text className={`text-[30px] font-extrabold tabular-nums ${toneClasses(tone).text}`}>
        {fmtMoney(shared.ownShare, currency, showCents)}
      </Text>
      <Text className="mt-1 text-[13.5px] font-semibold text-text-muted">
        {t('transactions.detail.shared.your_share_of', { total: fmtMoney(total, currency, showCents) })}
      </Text>
    </Tile>
  )
}

const AVATAR_PALETTE = ['bg-account-slate', 'bg-slate', 'bg-emerald', 'bg-warning']

export const TileDividedAmong = ({
  shared,
  currency,
  tone,
}: {
  shared: MovementSharedInfo
  currency: 'ARS' | 'USD'
  tone: Tone
}) => {
  const t = useT()
  const showCents = useShowCents()

  const people = [
    { name: t('transactions.detail.shared.you'), amount: shared.ownShare, isYou: true },
    ...shared.bySplit.map((s) => ({ name: s.name || '—', amount: s.amount, isYou: false })),
  ]
  const amounts = people.map((p) => p.amount)
  const allEqual = amounts.every((a) => Math.abs(a - amounts[0]!) < 0.005)

  return (
    <Tile>
      <TileHead
        eyebrow={t('transactions.detail.shared.divided_among')}
        aside={allEqual ? t('transactions.detail.shared.each', { amount: fmtMoney(amounts[0]!, currency, showCents) }) : undefined}
        asideMuted
      />
      <View className="flex-col">
        {people.map((p, i) => (
          <View
            key={`${p.name}-${i}`}
            className={`flex-row items-center gap-3.5 py-3 ${i === 0 ? '' : 'border-t border-border'}`}
          >
            <View
              className={`h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${
                p.isYou ? toneClasses(tone).fill : AVATAR_PALETTE[(i - 1) % AVATAR_PALETTE.length]
              }`}
            >
              <Text className="text-[13.5px] font-extrabold text-white">{initialsOf(p.name)}</Text>
            </View>
            <Text className="min-w-0 flex-1 text-[14.5px] font-bold text-text">{p.name}</Text>
            <Text className="text-[15px] font-extrabold tabular-nums text-text">
              {fmtMoney(p.amount, currency, showCents)}
            </Text>
          </View>
        ))}
      </View>
    </Tile>
  )
}

// ── Descripción ──────────────────────────────────────────────────────────────

export const TileDescription = ({ description }: { description: string | null }) => {
  const t = useT()
  if (!description?.trim()) return null
  return (
    <Tile>
      <TileHead eyebrow={t('transactions.detail.labels.description')} />
      <Text className="text-[14.5px] font-medium leading-[1.5] text-text">{description}</Text>
    </Tile>
  )
}

// ── Detalle genérico (filas clave/valor) ─────────────────────────────────────

export type DetailRowSpec = {
  key: string
  icon?: ReactNode
  label: ReactNode
  value: ReactNode
  rightLabel?: ReactNode
  rightValue?: ReactNode
}

export const TileDetail = ({ rows }: { rows: DetailRowSpec[] }) => {
  const t = useT()
  if (!rows.length) return null
  return (
    <Tile>
      <TileHead eyebrow={t('transactions.detail.groups.details')} />
      {rows.map((r, i) => (
        <DetailRow
          key={r.key}
          first={i === 0}
          icon={r.icon}
          label={r.label}
          value={r.value}
          rightLabel={r.rightLabel}
          rightValue={r.rightValue}
        />
      ))}
    </Tile>
  )
}
