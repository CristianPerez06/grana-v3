import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

const DashboardPage = async () => {
  const t = await getTranslations('dashboard')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let fullName = ''
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    fullName = data?.full_name ?? ''
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">
        {fullName ? t('welcome', { name: fullName }) : t('welcome_anon')}
      </p>
    </section>
  )
}

export default DashboardPage
