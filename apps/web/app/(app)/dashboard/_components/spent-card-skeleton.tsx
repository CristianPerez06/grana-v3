import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SpentCardBodySkeleton } from './spent-card-body-skeleton'

/**
 * Shape-matched skeleton for "Cuánto gastaste".
 *
 * The header is REAL from the first paint — title and link to Movimientos — and
 * only the body is skeleton: the header does not depend on the read, it is
 * static text plus a link, and hiding it makes the card appear out of nowhere
 * instead of filling in (spec `dashboard`).
 *
 * Before this component the card had no loading state at all: with the query
 * unresolved the three amounts fell to 0, `isEmpty` came out `true` and the card
 * claimed "Sin gastos este mes." while it was still loading.
 */
export const SpentCardSkeleton = async () => {
  const t = await getTranslations('dashboard.spent')
  return (
    <Card className="flex flex-col" aria-busy="true" aria-label={t('loading')}>
      <CardHeader className="flex-row items-center justify-between gap-3 px-4 sm:px-6">
        <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-text">
          {t('title')}
        </h2>
        <Link
          href="/transactions"
          className="shrink-0 whitespace-nowrap rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('view_detail')} ›
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 sm:px-6">
        <SpentCardBodySkeleton />
      </CardContent>
    </Card>
  )
}
