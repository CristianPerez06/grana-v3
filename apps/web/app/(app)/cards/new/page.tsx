import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { getCardNetworks } from '@/lib/cards/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCardForm } from '../_components/create-card-form'

const NewCardPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [institutions, networks] = await Promise.all([
    getInstitutions(),
    getCardNetworks(),
  ])

  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('new.title')}
        description={t('new.subtitle_full')}
        backLink={{ href: '/cards', label: t('back_label') }}
      />

      <CreateCardForm institutions={institutions} networks={networks} variant="page" />
    </div>
  )
}

export default NewCardPage
