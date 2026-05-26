'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  Coins,
  CreditCard,
  Repeat,
  Scale,
  Tag,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import type { FinancialMovement, MovementReviewFlag } from '../movements'

const movementIcon = {
  income: ArrowDownLeft,
  expense: Tag,
  card_payment: CreditCard,
  transfer: ArrowLeftRight,
  adjustment: Scale,
  installment_purchase: CreditCard,
  exchange: Coins,
} satisfies Record<FinancialMovement['kind'], React.ComponentType<{ className?: string; size?: number }>>

const movementTone = (movement: FinancialMovement) => {
  if (movement.kind === 'income') return 'text-green-600'
  if (movement.kind === 'adjustment' && movement.sign === '+') return 'text-green-600'
  return 'text-foreground'
}

const formatAmount = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

type Props = {
  movements: FinancialMovement[]
  recurrenceLinkedIds?: Set<string>
}

export const GlobalMovementList = ({ movements, recurrenceLinkedIds }: Props) => {
  const showCents = useShowCents()
  const locale = useLocale()
  const t = useTranslations('transactions')

  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(localeCode, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const reviewLabel: Record<MovementReviewFlag, string> = {
    missing_category: t('review_flags.missing_category'),
    missing_fx_rate: t('review_flags.missing_fx_rate'),
  }

  const movementSubtitle = (movement: FinancialMovement): string | null => {
    if (movement.kind === 'transfer') {
      return `${movement.account_name ?? t('labels.source_account')} → ${movement.destination_account_name ?? t('labels.destination_account')}`
    }

    if (movement.kind === 'installment_purchase') {
      return movement.installments_total
        ? t('list.installment_subtitle', { count: movement.installments_total })
        : t('installment_purchase_label')
    }

    if (movement.kind === 'card_payment') {
      return movement.account_name
        ? t('list.card_payment_from', { accountName: movement.account_name })
        : t('card_payment_label')
    }

    if (movement.kind === 'exchange') {
      // Source leg shows negative on the right; the received leg shows positive here.
      return `+ ${formatAmount(movement.destination_amount, movement.destination_currency, showCents)}`
    }

    return movement.description ?? movement.account_name ?? null
  }

  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium text-foreground">{t('empty.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('list.global_empty_description')}
        </p>
      </div>
    )
  }

  const grouped = new Map<string, FinancialMovement[]>()
  for (const movement of movements) {
    const existing = grouped.get(movement.date) ?? []
    existing.push(movement)
    grouped.set(movement.date, existing)
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(grouped.entries()).map(([date, dayMovements]) => (
        <section key={date}>
          <p className="mb-2 text-xs font-medium text-muted-foreground capitalize">
            {formatDate(date)}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {dayMovements.map((movement) => {
              const Icon = movementIcon[movement.kind]
              const isRecurrent = recurrenceLinkedIds?.has(movement.id) ?? false
              const content = (
                <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{movement.title}</span>
                        {isRecurrent && (
                          <Repeat
                            size={12}
                            className="shrink-0 text-muted-foreground"
                            aria-label={t('generated_by_rule')}
                          />
                        )}
                        {movement.review_flags.length > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            <AlertTriangle size={12} />
                            {t('list.review_short')}
                          </span>
                        )}
                      </div>
                      {movementSubtitle(movement) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {movementSubtitle(movement)}
                        </p>
                      )}
                      {movement.review_flags.length > 0 && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          {movement.review_flags.map((flag) => reviewLabel[flag]).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${movementTone(movement)}`}>
                      {movement.sign}
                      {formatAmount(movement.amount, movement.currency_code, showCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">{movement.currency_code}</p>
                  </div>
                </div>
              )

              if (!movement.detail_href) {
                return <div key={movement.id}>{content}</div>
              }

              return (
                <Link key={movement.id} href={`${movement.detail_href}?from=transactions`}>
                  {content}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
