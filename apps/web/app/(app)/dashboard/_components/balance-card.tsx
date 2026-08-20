import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import {
  derivePlacement,
  type CurrencyPlacement,
  type DashboardHero,
  type MonthBalanceByCurrency,
  type PlacementRow,
} from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'
import { MonthSummary } from './month-summary'

type Props = {
  data: DashboardHero
  /** Current-month series for the light zone. Null when that read failed. */
  monthInitialData: MonthBalanceByCurrency | null
}

// Account identity color for the row swatch — same source as the AccountAvatar
// (palette key token, else institution override, else slate).
const avatarColor = (avatar: ResolvedAccountAvatar): string =>
  avatar.colorKey ? `var(--account-${avatar.colorKey})` : (avatar.colorOverride ?? 'var(--account-slate)')

/**
 * The accounts of ONE currency, laid out in two implicit sub-columns.
 *
 * Stacked vertically, each row spanned the full ~320px of its currency column
 * and `ml-auto` pushed the percentage to the far edge, leaving a wide gap
 * between the name and its number. Side by side, each account gets ~155px and
 * reads as a tight pair; with a single account it occupies the first cell, so
 * the gap lands after the pair instead of inside it.
 *
 * Web only: at 390px a native column is ~170px, and halving that would leave no
 * room for a name. The native card keeps them stacked.
 */
const PlacementColumn = ({ placement }: { placement: CurrencyPlacement }) => (
  <div className="grid grid-cols-2 gap-x-5 gap-y-2">
    {placement.rows.map((row: PlacementRow) => (
      <div key={row.id} className="flex items-center gap-2 text-[13.5px] font-semibold text-white/65">
        <span
          aria-hidden
          className="size-[10px] shrink-0 rounded-[2px]"
          style={{ backgroundColor: avatarColor(row.avatar) }}
        />
        {/* The percentage sits right after its name, NOT pushed to the cell edge:
            with `ml-auto` the slack landed between a name and its own number, so
            "81%" read as belonging to the account listed next to it. Tight pair,
            slack after it. */}
        <span className="min-w-0 truncate">{row.label}</span>
        <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-white">
          {row.pct}%
        </span>
      </div>
    ))}
  </div>
)

/**
 * "Saldo disponible total" — one card with two zones: a dark one with today's
 * total, the USD line and the "Dónde está" breakdown folded in, and a light one
 * with "Resumen del mes".
 *
 * The breakdown lives INSIDE the hero (it used to be a sibling card) because it
 * answers the same question the total does: how much I have, and where. Each
 * currency is ranked on its own and shows its top accounts with their share of
 * that currency — the two are never summed nor converted (see `derivePlacement`).
 *
 * Both the USD line and each currency column are skipped when that currency
 * holds nothing, so a peso-only user reads the card as monocurrency instead of
 * scanning past zeros.
 *
 * The available balance is TODAY's and does not follow the month selector; the
 * summary zone below does.
 */
export const BalanceCard = async ({ data, monthInitialData }: Props) => {
  const t = await getTranslations('dashboard')
  const placement = derivePlacement(data.accounts)
  const hasUsd = placement.USD.rows.length > 0 || data.usd !== 0

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-surface-dark px-[22px] pb-5 pt-6 text-center text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/50">
          {t('hero.total_label')}
        </p>

        <p className="mt-[11px] text-[clamp(2.125rem,3.4vw,2.625rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">
          <MaskedAmountDisplay amount={data.ars} currency="ARS" dimSymbol />
        </p>

        {hasUsd && (
          <p className="mt-[13px] flex items-center justify-center gap-2.5">
            <span className="rounded-full bg-emerald/20 px-2.5 py-1 text-[11px] font-extrabold leading-none text-mint">
              USD
            </span>
            <span className="text-[16px] font-bold text-white/90">
              <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
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

      <MonthSummary initialData={monthInitialData} />
    </Card>
  )
}
