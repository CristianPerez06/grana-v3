import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShowCents } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { AppShell } from './_components/app-shell'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showCents = await getShowCents()

  return (
    <PreferencesProvider showCents={showCents}>
      <AppShell>{children}</AppShell>
    </PreferencesProvider>
  )
}

export default AppLayout
