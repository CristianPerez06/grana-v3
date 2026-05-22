import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShowCents, getSidebarCollapsed } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { AppShell } from './_components/app-shell'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [showCents, sidebarCollapsed] = await Promise.all([
    getShowCents(),
    getSidebarCollapsed(),
  ])

  return (
    <PreferencesProvider showCents={showCents}>
      <AppShell initialCollapsed={sidebarCollapsed}>{children}</AppShell>
    </PreferencesProvider>
  )
}

export default AppLayout
