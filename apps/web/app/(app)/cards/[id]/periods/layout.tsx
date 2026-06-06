import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

const CardPeriodsLayout = async ({ children, params }: Props) => {
  const { id } = await params
  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title={t('list.periods_title')}
        backLink={{ href: `/cards/${id}`, label: t('back_label') }}
      />
      {children}
    </div>
  )
}

export default CardPeriodsLayout
