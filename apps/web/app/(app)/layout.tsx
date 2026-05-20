import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getShowCents } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { Header } from './_components/header'
import { Sidebar, SidebarProvider } from './_components/sidebar'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showCents = await getShowCents()
  const t = await getTranslations('common')

  return (
    <PreferencesProvider showCents={showCents}>
      <SidebarProvider>
        <div className="flex flex-1 flex-col">
          <Header />
          <div className="flex flex-1">
            <Sidebar logoutLabel={t('logout')} />
            <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PreferencesProvider>
  )
}

export default AppLayout
