import { requireUserId } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getShowCents, getSidebarCollapsed } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { AppQueryProvider } from './_components/app-query-provider'
import { AppShell } from './_components/app-shell'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const userId = await requireUserId()
  const supabase = await createClient()

  const [{ data: auth }, { data: profile }, showCents, sidebarCollapsed] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    getShowCents(),
    getSidebarCollapsed(),
  ])

  const userName = profile?.full_name?.trim() || null
  const userEmail = auth.user?.email ?? null

  return (
    <AppQueryProvider>
      <PreferencesProvider showCents={showCents}>
        <AppShell initialCollapsed={sidebarCollapsed} userName={userName} userEmail={userEmail}>
          {children}
        </AppShell>
      </PreferencesProvider>
    </AppQueryProvider>
  )
}

export default AppLayout
