import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShowCents } from '@/lib/preferences'
import { PreferencesProvider } from '@/lib/preferences-context'
import { Header } from './_components/header'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showCents = await getShowCents()

  return (
    <PreferencesProvider showCents={showCents}>
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </div>
    </PreferencesProvider>
  )
}

export default AppLayout
