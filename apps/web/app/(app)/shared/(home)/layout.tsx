import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { RegisterMovementButton } from '@/lib/transactions/components/register-movement-button'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { getHousehold } from '@/lib/shared/queries'
import { createClient } from '@/lib/supabase/server'

// Configuración del hogar — icon-only (no label), per the redesign.
const SettingsIconLink = ({ label }: { label: string }) => (
  <Link
    href="/shared/settings"
    aria-label={label}
    title={label}
    className="inline-grid size-10 place-items-center rounded-full border border-border bg-card text-text-muted transition-colors hover:bg-border-soft hover:text-text"
  >
    <Settings2 className="size-[18px]" aria-hidden />
  </Link>
)

const SharedHomeLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('shared')
  const household = await getHousehold(await createClient())
  const title = household?.name ?? t('title')
  // Only the active household (two members) gets the wide operational layout;
  // setup and waiting-for-member states stay narrow.
  const isActive = (household?.members.length ?? 0) >= 2
  // Register-movement CTA (reuses the library button; self-disables until the
  // app-shell movement drawer resolves) + icon-only settings access.
  const actions = household ? (
    <div className="flex items-center gap-2">
      {isActive && <RegisterMovementButton />}
      <SettingsIconLink label={t('settings.title')} />
    </div>
  ) : undefined

  return (
    <div className={`flex flex-col gap-6 ${isActive ? 'max-w-[960px]' : 'max-w-lg'}`}>
      <PageHeader title={title} actions={actions} />
      {children}
      {isActive && <QuickAddFab />}
    </div>
  )
}

export default SharedHomeLayout
