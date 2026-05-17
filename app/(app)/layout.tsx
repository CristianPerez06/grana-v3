import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from './_components/header'

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}

export default AppLayout
