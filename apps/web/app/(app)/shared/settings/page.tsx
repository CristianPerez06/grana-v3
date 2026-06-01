import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'
import { SettingsForm } from './_components/settings-form'

export default async function SharedSettingsPage() {
  const household = await getHousehold()
  if (!household) redirect('/shared')

  const t = await getTranslations('shared')
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={t('settings.title')} backLink={{ href: '/shared', label: t('title') }} />
      <SettingsForm household={household} />
    </div>
  )
}
