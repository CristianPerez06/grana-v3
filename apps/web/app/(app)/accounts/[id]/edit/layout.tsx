import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

const EditAccountLayout = async ({ children, params }: Props) => {
  const { id } = await params
  const t = await getTranslations()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('accounts.edit_title')}
        backLink={{ href: `/accounts/${id}`, label: t('transactions.account_back_label') }}
      />
      {children}
    </div>
  )
}

export default EditAccountLayout
