import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'

const SharedSettingsLayout = async ({ children }: { children: React.ReactNode }) => {
  const household = await getHousehold()
  if (!household) redirect('/shared')

  const t = await getTranslations('shared')
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={t('settings.title')} backLink={{ href: '/shared', label: t('title') }} />
      {children}
    </div>
  )
}

export default SharedSettingsLayout
