import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string; periodId: string }>
}

const PeriodDetailLayout = async ({ children, params }: Props) => {
  const { id } = await params
  const t = await getTranslations('cards')

  // Layout sync: chrome SIEMPRE visible. El título dinámico (rango de fechas)
  // y las acciones (EditDatesSheet) viven en el page.tsx, que las renderiza
  // cuando el período resuelve. El back-link es estático.
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title={t('period.detail_title')}
        backLink={{ href: `/cards/${id}/periods`, label: t('list.periods_title') }}
      />
      {children}
    </div>
  )
}

export default PeriodDetailLayout
