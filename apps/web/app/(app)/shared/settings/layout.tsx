import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'
import { createClient } from '@/lib/supabase/server'

const SharedSettingsLayout = async ({ children }: { children: React.ReactNode }) => {
  const household = await getHousehold(await createClient())
  if (!household) redirect('/shared')

  const t = await getTranslations('shared')
  return (
    <div className="flex flex-col gap-6 max-w-[760px]">
      <PageHeader title={t('settings.title')} backLink={{ href: '/shared', label: t('title') }} />
      {children}
    </div>
  )
}

export default SharedSettingsLayout
