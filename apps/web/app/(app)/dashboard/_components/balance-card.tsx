'use client'

import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import {
  derivePlacement,
  type CurrencyPlacement,
  type DashboardHero,
  type MonthBalanceByCurrency,
  type PlacementRow,
} from '@grana/dashboard'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'
import { useBalanceMonth } from './use-balance-month'

type Props = {
  todayISO: string
  heroInitial: DashboardHero | null
  monthInitial: MonthBalanceByCurrency | null
}

// Account identity color for the row swatch — same source as the AccountAvatar
// (palette key token, else institution override, else slate).
const avatarColor = (avatar: ResolvedAccountAvatar): string =>
  avatar.colorKey ? `var(--account-${avatar.colorKey})` : (avatar.colorOverride ?? 'var(--account-slate)')

/**
 * The accounts of ONE currency, laid out in two implicit sub-columns.
 *
 * Each account is a TIGHT pair (name immediately followed by its percentage),
 * and the two pairs are pushed apart: the first anchors to the left edge of the
 * currency column, the second to the right edge — which lands its percentage
 * directly under the column's header label. All the slack sits between the two
 * pairs, where it separates them, instead of inside a pair, where it made a
 * percentage read as belonging to the account listed next to it.
 *
 * With a single account it stays on the left and the column simply reads short.
 */
const PlacementColumn = ({ placement }: { placement: CurrencyPlacement }) => (
  <div className="grid grid-cols-2 gap-x-5 gap-y-2">
    {placement.rows.map((row: PlacementRow, index: number) => (
      <div
        key={row.id}
        className={cn(
          'flex items-center gap-2 text-[13.5px] font-semibold text-white/65',
          index === 1 && 'justify-end',
        )}
      >
        <span
          aria-hidden
          className="size-[10px] shrink-0 rounded-[2px]"
          style={{ backgroundColor: avatarColor(row.avatar) }}
        />
        <span className="min-w-0 truncate">{row.label}</span>
        <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-white">
          {row.pct}%
        </span>
      </div>
    ))}
  </div>
)

/**
 * One amount of "Resumen del mes".
 *
 * `signPrefix` goes on the two FLOWS ("+" for what came in, "−" for what went
 * out) and not on the carried-in balance: that one shows its own sign only when
 * it is actually negative. Otherwise the same "−" would mean two different
 * things side by side — a balance in the red, and money leaving.
 */
const Flow = ({
  label,
  dotClassName,
  amountClassName,
  ars,
  usd,
  showUsd,
  signPrefix,
}: {
  label: string
  dotClassName: string
  amountClassName: string
  ars: number
  usd: number
  /**
   * Decided ONCE for the whole block, not per amount: three peer amounts have
   * to line up, and hiding the USD line only where it is zero left one column
   * taller than its neighbours and the three no longer comparable at a glance.
   * A month with no dollars at all still shows no USD line anywhere.
   */
  showUsd: boolean
  signPrefix?: string
}) => (
  <div className="flex flex-col items-center text-center">
    <span className="flex items-center gap-[9px] text-[14px] font-bold text-text-muted">
      <span aria-hidden className={cn('size-[9px] rounded-full', dotClassName)} />
      {label}
    </span>
    <span
      className={cn(
        'mt-2.5 text-[22px] font-extrabold leading-none tracking-[-0.04em]',
        amountClassName,
      )}
    >
      <MaskedAmount amount={ars} currency="ARS" signPrefix={signPrefix} />
    </span>
    {showUsd && (
      <span className="mt-[5px] text-[12.5px] font-semibold text-text-soft">
        <MaskedAmount amount={usd} currency="USD" showCentsOverride signPrefix={signPrefix} />
      </span>
    )}
  </div>
)

/**
 * "Saldo disponible total" — one card with two zones: a dark one with the
 * balance, the USD line and the "Dónde está" breakdown folded in, and a light
 * one with "Resumen del mes".
 *
 * The whole card follows the month selector. The balance is cut at the selected
 * month's last day, so the three amounts below it close against it:
 *
 *     Venía + Entró − Se fue === el saldo de arriba
 *
 * which makes the card auditable on screen. Standing on a past month the label
 * says so: what you had at that month's close is not what you have available
 * today.
 */
export const BalanceCard = ({ todayISO, heroInitial, monthInitial }: Props) => {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const { hero, summary, venia, isCurrent, selected } = useBalanceMonth({
    todayISO,
    heroInitial,
    monthInitial,
  })

  const placement = derivePlacement(hero?.accounts ?? [])
  // One decision for the whole summary block (see `Flow`).
  const summaryHasUsd =
    (venia?.USD ?? 0) !== 0 ||
    (summary?.USD.entro ?? 0) !== 0 ||
    (summary?.USD.seFue ?? 0) !== 0
  const hasUsd = placement.USD.rows.length > 0 || (hero?.usd ?? 0) !== 0
  const monthLabel = format.dateTime(new Date(selected.year, selected.month - 1, 1), {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-surface-dark px-[22px] pb-5 pt-6 text-center text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/50">
          {isCurrent ? t('hero.total_label') : t('hero.balance_as_of', { month: monthLabel })}
        </p>

        <p className="mt-[11px] text-[clamp(2.125rem,3.4vw,2.625rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">
          <MaskedAmountDisplay amount={hero?.ars ?? 0} currency="ARS" dimSymbol />
        </p>

        {hasUsd && (
          <p className="mt-[13px] flex items-center justify-center gap-2.5">
            <span className="rounded-full bg-emerald/20 px-2.5 py-1 text-[11px] font-extrabold leading-none text-mint">
              USD
            </span>
            <span className="text-[16px] font-bold text-white/90">
              <MaskedAmount amount={hero?.usd ?? 0} currency="USD" showCentsOverride />
            </span>
          </p>
        )}

        {/* "Dónde está" — the labels and the columns below are capped and centered
            so the data does not spread out on a wide desktop. The action escapes
            that cap and anchors to the card's right edge: inside the cap it read
            as floating in the middle of the header. */}
        <div className="relative mt-[18px]">
          <div className="mx-auto grid max-w-[660px] grid-cols-2 items-end gap-4 border-t border-white/10 pt-[15px]">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white/50">
                {t('accounts.title')}
              </span>
              <span className="text-[11.5px] font-extrabold tracking-[0.12em] text-white/65">
                ARS
              </span>
            </span>
            {/* text-left against the dark zone's `text-center`, so the label sits
                over its column instead of centering in the cell. */}
            <span className="pl-[15px] text-left text-[11.5px] font-extrabold tracking-[0.12em] text-white/65">
              {hasUsd ? 'USD' : ''}
            </span>
          </div>
          <Link
            href="/accounts"
            className="absolute bottom-0 right-0 whitespace-nowrap rounded text-[13.5px] font-bold text-mint transition-colors hover:text-mint-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('accounts.view_accounts')} ›
          </Link>
        </div>

        <div className="mx-auto mt-3 grid max-w-[660px] grid-cols-2 gap-4 text-left">
          <PlacementColumn placement={placement.ARS} />
          <div className="border-l border-white/10 pl-[15px]">
            <PlacementColumn placement={placement.USD} />
          </div>
        </div>
      </div>

      {/* Resumen del mes — the three amounts add up to the balance above. */}
      <div className="border-t border-border px-[26px] pb-5 pt-5">
        <h3 className="text-[18px] font-extrabold tracking-[-0.025em] text-text">
          {t('month.summary_title')}
        </h3>
        <div className="mx-auto mt-[15px] grid max-w-[660px] grid-cols-3 gap-[18px]">
          <Flow
            label={t('month.carried_in')}
            dotClassName="bg-text-soft"
            amountClassName="text-text"
            ars={venia?.ARS ?? 0}
            usd={venia?.USD ?? 0}
            showUsd={summaryHasUsd}
          />
          <Flow
            label={t('month.came_in')}
            dotClassName="bg-emerald"
            amountClassName="text-emerald-deep"
            ars={summary?.ARS.entro ?? 0}
            usd={summary?.USD.entro ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="+"
          />
          <Flow
            label={t('month.went_out')}
            dotClassName="bg-slate"
            amountClassName="text-slate"
            ars={summary?.ARS.seFue ?? 0}
            usd={summary?.USD.seFue ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="−"
          />
        </div>
      </div>
    </Card>
  )
}
