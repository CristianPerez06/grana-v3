import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'
import { SetupForm } from './_components/setup-form'

export default async function SharedSetupPage() {
  const household = await getHousehold()
  if (household) redirect('/shared')

  const t = await getTranslations('shared')
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={t('setup.title')} backLink={{ href: '/shared', label: t('title') }} />
      <SetupForm />
    </div>
  )
}
