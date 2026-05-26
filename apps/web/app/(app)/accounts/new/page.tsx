import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateAccountForm } from './_components/create-account-form'

const NewAccountPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Novato can't create accounts (UI-only gating; see accounts spec). Guards
  // direct navigation to this route — the button is also hidden in the list.
  const { data: profile } = await supabase
    .from('profiles')
    .select('mode')
    .eq('id', user.id)
    .single()
  if (profile?.mode === 'novato') redirect('/accounts')

  const t = await getTranslations('accounts')
  const institutions = await getInstitutions()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('actions.create')}
        backLink={{ href: '/accounts', label: t('title') }}
      />
      <CreateAccountForm institutions={institutions} />
    </div>
  )
}

export default NewAccountPage
