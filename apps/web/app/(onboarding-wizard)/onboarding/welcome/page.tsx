import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

const WelcomePage = async () => {
  const t = await getTranslations('onboarding.welcome')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-8 text-center">
      <div className="flex flex-col gap-3">
        {firstName && (
          <p className="text-sm text-text-muted">
            {t('greeting', { name: firstName })}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('description')}</p>
      </div>

      <Button asChild>
        <Link href="/onboarding/perfil">{t('cta')}</Link>
      </Button>
    </div>
  )
}

export default WelcomePage
