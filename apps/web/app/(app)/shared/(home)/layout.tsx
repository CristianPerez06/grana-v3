import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { getHousehold } from '@/lib/shared/queries'

const SettingsLink = ({ label }: { label: string }) => (
  <Link
    href="/shared/settings"
    className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
  >
    <Settings2 className="size-4" aria-hidden />
    {label}
  </Link>
)

const SharedHomeLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('shared')
  const household = await getHousehold()
  const title = household?.name ?? t('title')
  const actions = household ? <SettingsLink label={t('settings.title')} /> : undefined

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={title} actions={actions} />
      {children}
    </div>
  )
}

export default SharedHomeLayout
