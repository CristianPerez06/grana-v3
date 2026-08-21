import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SpentCardBodySkeleton } from './spent-card-body-skeleton'

/**
 * Skeleton shape-matched de "Cuánto gastaste".
 *
 * El encabezado va REAL desde el primer paint —título y link a Movimientos— y
 * solo el cuerpo es skeleton: el encabezado no depende de la lectura, es texto
 * estático más un link, y esconderlo hace que la card aparezca de la nada en vez
 * de llenarse (spec `dashboard`).
 *
 * Antes de este componente la card no tenía estado de carga: con la query sin
 * resolver los tres montos caían a 0, `isEmpty` daba `true` y la card afirmaba
 * "Sin gastos este mes." mientras cargaba.
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
