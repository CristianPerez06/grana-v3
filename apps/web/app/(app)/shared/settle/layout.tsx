import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'
import { createClient } from '@/lib/supabase/server'

const SharedSettleLayout = async ({ children }: { children: React.ReactNode }) => {
  const household = await getHousehold(await createClient())
  if (!household || household.members.length < 2) redirect('/shared')

  const t = await getTranslations('shared')
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={t('settle.title')} backLink={{ href: '/shared', label: t('title') }} />
      {children}
    </div>
  )
}

export default SharedSettleLayout
