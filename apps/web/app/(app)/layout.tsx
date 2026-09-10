import { requireUserId } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getShowCents, getSidebarCollapsed } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { RecurrenceMaterializationProvider } from '@/lib/recurrences/materialization-context'
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
      {/* Materialization runs HERE, not per route: hanging it off /transactions
          and the recurrences hub meant a user who opened the app on the
          dashboard and stayed there never materialized anything. Inside the
          query provider because it invalidates on success. */}
      <RecurrenceMaterializationProvider>
        <PreferencesProvider showCents={showCents}>
          <AppShell initialCollapsed={sidebarCollapsed} userName={userName} userEmail={userEmail}>
            {children}
          </AppShell>
        </PreferencesProvider>
      </RecurrenceMaterializationProvider>
    </AppQueryProvider>
  )
}

export default AppLayout
