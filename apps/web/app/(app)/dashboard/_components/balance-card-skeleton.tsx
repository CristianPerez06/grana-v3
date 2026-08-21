import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import {
  HeroAmountSkeleton,
  HeroUsdSkeleton,
  PlacementGridSkeleton,
  SUMMARY_ALIGN,
  SummaryAmountSkeleton,
} from './balance-card-body-skeleton'
import { cn } from '@/lib/utils'

/** Mirror of `Flow`: a row (label left, amount right) when narrow, a column at `sm`. */
const FlowSkeleton = ({ align }: { align: keyof typeof SUMMARY_ALIGN }) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 sm:flex-col sm:justify-start',
      SUMMARY_ALIGN[align],
    )}
  >
    <span className="flex shrink-0 items-center gap-[9px]">
      <span className="size-[9px] animate-pulse rounded-full bg-muted" />
      <span className="h-4 w-16 animate-pulse rounded bg-muted/70" />
    </span>
    <span className={cn('flex min-w-0 flex-col items-end sm:mt-2.5 sm:w-full', SUMMARY_ALIGN[align])}>
      <SummaryAmountSkeleton />
    </span>
  </div>
)

/**
 * Shape-matched skeleton for "Saldo disponible total".
 *
 * ONE skeleton for the whole card, even though its zones come from two different
 * reads: they share a card, and filling them in separately would make it
 * assemble in jumps in front of the user (spec `dashboard`).
 *
 * It follows the SAME responsive composition as the real card, not an
 * approximation: "Dónde está" and the summary stack below `sm` and go to two and
 * three columns at `sm`. A skeleton drawing the desktop grid on a phone
 * anticipates a layout that never arrives — the failure this replacement fixes.
 *
 * It draws the hero's USD line and the USD column of "Dónde está" even though
 * the real card makes both conditional on there being dollars: that is the tall
 * case, and falling short makes the screen jump downwards when it resolves.
 */
export const BalanceCardSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card className="overflow-hidden p-0" aria-busy="true" aria-label={t('hero_loading')}>
      {/* Dark zone — balance, USD line and "Dónde está" folded inside. */}
      <div className="bg-surface-dark px-[22px] pb-5 pt-6 text-center">
        <div className="mx-auto h-3.5 w-40 animate-pulse rounded bg-white/15" />
        <HeroAmountSkeleton />
        <HeroUsdSkeleton />

        {/* "Dónde está" header: the label with "ARS" to its right, "USD" over
            the second column, and the link anchored to the card's edge. Both
            currency labels disappear once stacked, as they do in the card. */}
        <div className="relative mt-[18px]">
          <div className="mx-auto grid max-w-[660px] grid-cols-1 items-end gap-4 border-t border-white/10 pt-[15px] sm:grid-cols-2">
            <span className="flex items-baseline justify-between gap-2">
              <span className="h-3.5 w-24 animate-pulse rounded bg-white/10" />
              <span className="hidden h-3.5 w-8 animate-pulse rounded bg-white/10 sm:block" />
            </span>
            <span className="hidden pl-[15px] sm:block">
              <span className="block h-3.5 w-8 animate-pulse rounded bg-white/10" />
            </span>
          </div>
          <div className="absolute bottom-0 right-0 h-3.5 w-[104px] animate-pulse rounded bg-white/10" />
        </div>

        {/* Account columns: stacked with a horizontal divider when narrow, side
            by side with a vertical one from `sm`. */}
        <div className="mx-auto mt-3 grid max-w-[660px] grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-4">
          <PlacementGridSkeleton />
        </div>
      </div>

      {/* Resumen del mes — three blocks: stacked rows when narrow, thirds at `sm`. */}
      <div className="border-t border-border px-[26px] pb-[18px] pt-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-[18px]">
          <FlowSkeleton align="start" />
          <FlowSkeleton align="center" />
          <FlowSkeleton align="end" />
        </div>
      </div>
    </Card>
  )
}
