import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string; periodId: string }>
}

const PayPeriodLayout = async ({ children, params }: Props) => {
  const { id, periodId } = await params
  const t = await getTranslations('cards')

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('payment.title')}
        backLink={{ href: `/cards/${id}/periods/${periodId}`, label: t('payment.back_label') }}
      />
      {children}
    </div>
  )
}

export default PayPeriodLayout
