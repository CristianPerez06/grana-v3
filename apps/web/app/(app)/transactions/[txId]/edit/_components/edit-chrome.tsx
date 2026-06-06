'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Chrome del segmento /transactions/[txId]/edit. Cliente porque depende de
 * `useSearchParams().get('from')` para preservar la perspectiva al volver al
 * detalle. Se monta desde el layout para que el back-link y título queden
 * visibles desde el first paint, antes que `buildMovementEditContext` resuelva.
 */
export const EditChrome = () => {
  const params = useParams<{ txId: string }>()
  const sp = useSearchParams()
  const from = sp.get('from')
  const t = useTranslations('transactions')

  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''
  const detailHref = `/transactions/${params.txId}${fromQuery}`

  return (
    <PageHeader
      title={t('edit_title')}
      backLink={{ href: detailHref, label: t('detail_back_label') }}
    />
  )
}
