import { requireUserId } from '@/lib/auth/guards'
import { getShowCents, getSidebarCollapsed } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { AppQueryProvider } from './_components/app-query-provider'
import { AppShell } from './_components/app-shell'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  await requireUserId()

  const [showCents, sidebarCollapsed] = await Promise.all([
    getShowCents(),
    getSidebarCollapsed(),
  ])

  return (
    <AppQueryProvider>
      <PreferencesProvider showCents={showCents}>
        <AppShell initialCollapsed={sidebarCollapsed}>{children}</AppShell>
      </PreferencesProvider>
    </AppQueryProvider>
  )
}

export default AppLayout
