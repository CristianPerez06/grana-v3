'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import {
  densestAmountDensity,
  derivePlacement,
  type CurrencyPlacement,
  type DashboardHero,
  type MonthBalanceByCurrency,
  type AmountDensity,
  type PlacementRow,
  type SavingsRow,
} from '@grana/dashboard'
import { Card } from '@/components/ui/card'
import { SavingsDrawer } from '@/lib/savings/components/savings-drawer'
import { useShowCents } from '@/lib/preferences-context'
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
const PlacementColumn = ({
  placement,
  currency,
}: {
  placement: CurrencyPlacement
  currency: string
}) => (
  // Stacked (narrow): the currency is a LEFT GUTTER, not a row of its own — a
  // whole line for the word "ARS" is a line not spent on data — and the accounts
  // stack to its right, each with its percentage pushed hard right so the
  // percentages line up in a column, which is what gets compared.
  // Side by side (sm+): the gutter disappears into the shared header and the two
  // accounts go back to being tight pairs across two sub-columns.
  <div className="flex gap-3 sm:block">
    <span className="w-8 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/50 sm:hidden">
      {currency}
    </span>
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-5">
      {placement.rows.map((row: PlacementRow, index: number) => (
        <div
          key={row.id}
          className={cn(
            'flex items-center gap-2 text-[13.5px] font-semibold text-white/65',
            index === 1 && 'sm:justify-end',
          )}
        >
          <span
            aria-hidden
            className="size-[10px] shrink-0 rounded-[2px]"
            style={{ backgroundColor: avatarColor(row.avatar) }}
          />
          {/* `flex-1` only while stacked: it is what pushes the percentage to the
              right edge. Side by side the pair stays tight, so a percentage never
              reads as belonging to the account listed next to it. */}
          <span className="min-w-0 flex-1 truncate sm:flex-none">{row.label}</span>
          <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-white">
            {row.pct}%
          </span>
        </div>
      ))}
    </div>
  </div>
)

/** Same shrink rule as the spending tiles, on this zone's own scale. */
/**
 * Where each of the three blocks sits inside its column: first hard left, last
 * hard right, middle centred — so the three span the card edge to edge.
 *
 * They used to be left-aligned all three, on the argument that one shared rule
 * reads as one piece. On real data it does not: the columns are equal thirds and
 * the content is narrower than a third, so everything hugged the left and left a
 * dead strip against the card's right edge, with the block visibly off-centre.
 *
 * The columns stay equal thirds — the positions must NOT depend on the data, or
 * the three amounts would jump around as you page through months — and it is
 * each column's own alignment that pushes the content out to the edges. A very
 * long amount still stays inside its third: `amountDensity` steps the type down
 * before it can reach its neighbour.
 */
const ALIGN = {
  start: 'sm:items-start sm:text-left',
  center: 'sm:items-center sm:text-center',
  end: 'sm:items-end sm:text-right',
} as const

/**
 * Two scales, not one. Side by side, each amount is the headline of its own
 * column and carries the full size. Stacked into a row next to a 14px label it
 * is not a headline any more, it is the VALUE of that label — so it sits just
 * above it (16px against 14px) instead of towering over it. Extrabold weight and
 * tight tracking already make the number the thing the eye lands on; size on top
 * of that is what made the row stop reading as a pair.
 */
const SUMMARY_SIZE: Record<AmountDensity, string> = {
  normal: 'text-[16px] sm:text-[27px]',
  tight: 'text-[15px] sm:text-[24px]',
  tighter: 'text-[14px] sm:text-[21px]',
  tightest: 'text-[12.5px] sm:text-[18px]',
}

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
  align,
  density,
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
  /** Where the block sits inside its column — see ALIGN below. */
  align: keyof typeof ALIGN
  /** Type step, decided once for the three (see the card). */
  density: AmountDensity
}) => (
  // A ROW when narrow — label left, amount right — and a column once the three
  // fit side by side. Three thirds of a phone-width card is ~105px, and the
  // amounts carry `whitespace-nowrap`, so they overflowed their column and
  // printed on top of each other instead of wrapping.
  <div
    className={cn(
      'flex items-center justify-between gap-3 sm:flex-col sm:justify-start',
      ALIGN[align],
    )}
  >
    <span className="flex shrink-0 items-center gap-[9px] text-[14px] font-bold text-text-muted">
      <span aria-hidden className={cn('size-[9px] rounded-full', dotClassName)} />
      {label}
    </span>
    <span className={cn('flex min-w-0 flex-col items-end sm:mt-2.5 sm:w-full', ALIGN[align])}>
      <span
        className={cn(
          'whitespace-nowrap font-extrabold leading-none tracking-[-0.04em]',
          SUMMARY_SIZE[density],
          amountClassName,
        )}
      >
        <MaskedAmount amount={ars} currency="ARS" signPrefix={signPrefix} />
      </span>
      {/* Bimoneda: the USD line only shows when there is money in dollars. */}
      {showUsd && (
        <span className="mt-[5px] text-[12.5px] font-semibold text-text-soft">
          <MaskedAmount amount={usd} currency="USD" showCentsOverride signPrefix={signPrefix} />
        </span>
      )}
    </span>
  </div>
)

/**
 * The savings row — BELOW A RULE, never a fourth column of the strip.
 *
 * The strip of three is liquidity: money entering and leaving the accounts.
 * Saving is neither — it is a decision about money that stayed exactly where it
 * was — so making it a fourth sibling would claim it is the same kind of thing
 * as an income or an expense.
 *
 * It renders in ALL FOUR states, and that is deliberate. A row that appeared
 * only when there was activity would leave the hero subtracting money the screen
 * never names, in any month the user did not touch their savings, with no way to
 * reach the detail — and no way back for whoever dismissed the suggestion and
 * changed their mind.
 *
 * The sign comes from the STATE, never from the number: a raw signed net would
 * eventually print "Guardaste este mes +$50.000", which says the opposite of what
 * happened. Emerald, not terracotta — terracotta is reserved in Grana for what is
 * due or overdue, and this is progress.
 */
const SavingsLine = ({
  row,
  usdRow,
  showUsd,
  onOpen,
}: {
  row: SavingsRow
  usdRow: SavingsRow | null
  showUsd: boolean
  onOpen: () => void
}) => {
  const t = useTranslations('dashboard')
  const label = t(`savings.${row.state}`)
  const signPrefix = row.state === 'saved' ? '−' : row.state === 'released' ? '+' : undefined
  const isEmpty = row.state === 'empty'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border-t border-border-soft pt-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'flex shrink-0 items-center gap-[9px] text-[14px] font-bold',
          isEmpty ? 'text-text-soft' : 'text-text-muted',
        )}
      >
        {/* The empty state carries no colour either: it is an invitation, not a
            reading. One muted line is the whole price of the permanent door for
            someone who is never going to save. */}
        <span
          aria-hidden
          className={cn('size-[9px] rounded-full', isEmpty ? 'bg-border' : 'bg-emerald')}
        />
        {label}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        {!isEmpty && (
          <span className="flex flex-col items-end">
            <span className="whitespace-nowrap text-[17px] font-extrabold leading-none tracking-[-0.04em] text-emerald-deep">
              <MaskedAmount amount={row.amount} currency="ARS" signPrefix={signPrefix} />
            </span>
            {showUsd && usdRow && usdRow.state !== 'empty' && (
              <span className="mt-[5px] text-[12.5px] font-semibold text-text-soft">
                <MaskedAmount
                  amount={usdRow.amount}
                  currency="USD"
                  showCentsOverride
                  signPrefix={
                    usdRow.state === 'saved' ? '−' : usdRow.state === 'released' ? '+' : undefined
                  }
                />
              </span>
            )}
          </span>
        )}
        <span aria-hidden className="text-[15px] font-bold text-text-soft">
          ›
        </span>
      </span>
    </button>
  )
}

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
  const showCents = useShowCents()
  const [savingsOpen, setSavingsOpen] = useState(false)
  const { hero, summary, venia, savings, displayed, isCurrent, selected } = useBalanceMonth({
    todayISO,
    heroInitial,
    monthInitial,
  })

  const placement = derivePlacement(hero?.accounts ?? [])
  // One type step for the three amounts, so they never shrink at different
  // points — same rule as the tiles of "Cuánto gastaste".
  const summaryDensity = densestAmountDensity(
    [venia?.ARS ?? 0, summary?.ARS.entro ?? 0, summary?.ARS.seFue ?? 0],
    showCents,
  )
  // One decision for the whole summary block (see `Flow`).
  const summaryHasUsd =
    (venia?.USD ?? 0) !== 0 ||
    (summary?.USD.entro ?? 0) !== 0 ||
    (summary?.USD.seFue ?? 0) !== 0
  const hasUsd = placement.USD.rows.length > 0 || displayed.USD !== 0
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
          {/* The disponible real in the current month; the closing balance in a
              past one. The label above already tells them apart, and the reserve
              is netted exactly where it says "disponible". */}
          <MaskedAmountDisplay amount={displayed.ARS} currency="ARS" dimSymbol />
        </p>

        {hasUsd && (
          <p className="mt-[13px] flex items-center justify-center gap-2.5">
            <span className="rounded-full bg-emerald/20 px-2.5 py-1 text-[11px] font-extrabold leading-none text-mint">
              USD
            </span>
            <span className="text-[16px] font-bold text-white/90">
              <MaskedAmount amount={displayed.USD} currency="USD" showCentsOverride />
            </span>
          </p>
        )}

        {/* "Dónde está" — the labels and the columns below are capped and centered
            so the data does not spread out on a wide desktop. The action escapes
            that cap and anchors to the card's right edge: inside the cap it read
            as floating in the middle of the header. */}
        <div className="relative mt-[18px]">
          <div className="mx-auto grid max-w-[660px] grid-cols-1 items-end gap-4 border-t border-white/10 pt-[15px] sm:grid-cols-2">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white/50">
                {t('accounts.title')}
              </span>
              <span className="hidden text-[11.5px] font-extrabold tracking-[0.12em] text-white/65 sm:inline">
                ARS
              </span>
            </span>
            {/* text-left against the dark zone's `text-center`, so the label sits
                over its column instead of centering in the cell. Hidden while the
                columns are stacked: it would sit over nothing. */}
            <span className="hidden pl-[15px] text-left text-[11.5px] font-extrabold tracking-[0.12em] text-white/65 sm:inline">
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

        {/* Side by side on desktop, STACKED when narrow: two currency columns in
            ~145px each truncated the account names down to "M" and "L…". Stacked,
            each block gets the full width and the names survive. The divider
            turns with the layout — vertical between columns, horizontal between
            stacked blocks. */}
        <div className="mx-auto mt-3 grid max-w-[660px] grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-4">
          <PlacementColumn placement={placement.ARS} currency="ARS" />
          {hasUsd && (
            <div className="border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-[15px] sm:pt-0">
              <PlacementColumn placement={placement.USD} currency="USD" />
            </div>
          )}
        </div>
      </div>

      {/* Resumen del mes — the three amounts add up to the balance above. */}
      <div className="border-t border-border px-[26px] pb-[18px] pt-4">
        <h3 className="text-[18px] font-extrabold tracking-[-0.025em] text-text">
          {t('month.summary_title')}
        </h3>
        <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-[18px]">
          <Flow
            label={t('month.carried_in')}
            dotClassName="bg-text-soft"
            amountClassName="text-text"
            ars={venia?.ARS ?? 0}
            usd={venia?.USD ?? 0}
            showUsd={summaryHasUsd}
            align="start"
            density={summaryDensity}
          />
          <Flow
            label={t('month.came_in')}
            dotClassName="bg-emerald"
            amountClassName="text-emerald-deep"
            ars={summary?.ARS.entro ?? 0}
            usd={summary?.USD.entro ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="+"
            align="center"
            density={summaryDensity}
          />
          <Flow
            label={t('month.went_out')}
            dotClassName="bg-slate"
            amountClassName="text-slate"
            ars={summary?.ARS.seFue ?? 0}
            usd={summary?.USD.seFue ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="−"
            align="end"
            density={summaryDensity}
          />
        </div>

        {savings.ARS && (
          <SavingsLine
            row={savings.ARS}
            usdRow={savings.USD}
            showUsd={summaryHasUsd}
            onOpen={() => setSavingsOpen(true)}
          />
        )}
      </div>

      {/* With nothing set aside there is no detail worth reading, so the row goes
          straight to the act — two taps instead of three, through an empty
          screen nobody needs to see. */}
      <SavingsDrawer
        open={savingsOpen}
        onClose={() => setSavingsOpen(false)}
        initialMode={
          savings.ARS?.state === 'empty' ? { mode: 'save', currency: 'ARS' } : undefined
        }
      />
    </Card>
  )
}
