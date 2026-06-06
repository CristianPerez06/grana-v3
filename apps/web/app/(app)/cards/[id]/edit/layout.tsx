import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

const EditCardLayout = async ({ children, params }: Props) => {
  const { id } = await params
  const t = await getTranslations('cards')

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader
        title={t('edit.title')}
        backLink={{ href: `/cards/${id}`, label: t('back_label') }}
      />
      {children}
    </div>
  )
}

export default EditCardLayout
