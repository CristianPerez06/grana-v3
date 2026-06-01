import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import type { CreditCardSummary } from '@/lib/cards/queries'
import { CardStatusPill } from './card-status-pill'
import { CardLimitBar } from './card-limit-bar'
import { cardAccent, cardMonogram, pillTone, formatDayMonth } from './card-presentation'

type Props = {
  card: CreditCardSummary
  /** Resolved network display name (Visa / Amex / …) or null. */
  networkName: string | null
  /** Month label for the "Resumen <mes>" stat. */
  monthLabel: string
  showCents?: boolean
}

export const WalletCard = ({ card, networkName, monthLabel, showCents = false }: Props) => {
  const t = useTranslations('cards')
  const accent = cardAccent(card)
  const period = card.activePeriod
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const tone = pillTone(period?.alert ?? 'none', period?.variant ?? null)

  const usedPercent =
    card.credit_limit && card.credit_limit > 0
      ? Math.min(100, Math.round((pendingARS / card.credit_limit) * 100))
      : null

  return (
    <Card
      asChild
      className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-14px_rgba(11,26,43,0.28)]"
    >
    <Link
      href={`/cards/${card.id}`}
      className="flex flex-col gap-4 py-5 pl-7 pr-6"
    >
      {/* Accent stripe (left border, 4px) */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      {/* Header: avatar + name + meta + status pill */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[19px] font-extrabold text-white"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          {cardMonogram(card.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold leading-tight">{card.name}</p>
          <p className="truncate text-xs text-text-muted">
            {networkName ? t('wallet.meta', { network: networkName }) : t('wallet.meta_no_network')}
          </p>
        </div>
        <CardStatusPill tone={tone} />
      </div>

      {/* Stats: resumen / cierra / vence */}
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('wallet.stat_statement', { month: monthLabel })}
          </p>
          <p className="mt-0.5 truncate text-[19px] font-extrabold tabular-nums">
            {formatARS(pendingARS, showCents)}
          </p>
          {hasUSD && pendingUSD > 0 && (
            <p className="truncate text-xs text-text-muted tabular-nums">
              {formatUSD(pendingUSD, showCents)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('wallet.stat_close')}
          </p>
          <p className="mt-0.5 text-base tabular-nums">{formatDayMonth(period?.end_date ?? null)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('wallet.stat_due')}
          </p>
          <p className="mt-0.5 text-base tabular-nums">{formatDayMonth(period?.due_date ?? null)}</p>
        </div>
      </div>

      {/* Credit limit (optional) */}
      {usedPercent !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs text-text-muted">
              {t('wallet.limit_used', {
                used: formatARS(pendingARS, showCents),
                total: formatARS(card.credit_limit!, showCents),
              })}
            </p>
            <p className="text-xs font-semibold tabular-nums">{usedPercent}%</p>
          </div>
          <CardLimitBar percent={usedPercent} accent={accent} />
        </div>
      )}

      {/* Footer: installments count + view link */}
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-3">
        <span className="text-xs text-text-muted">
          {t('wallet.installments', { count: card.activeInstallmentsCount })}
        </span>
        <span className="text-xs font-semibold text-text-muted transition-colors group-hover:text-text">
          {t('wallet.view_statement')}
        </span>
      </div>
    </Link>
    </Card>
  )
}
