import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { getCardNetworks } from '@/lib/cards/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCreditCardForm } from './_components/create-credit-card-form'
import { CreateNovatoCreditCardForm } from './_components/create-novato-credit-card-form'

const NewCardPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('mode')
    .eq('id', user.id)
    .single()
  const isNovato = profile?.mode === 'novato'

  const [institutions, networks] = await Promise.all([
    getInstitutions(),
    getCardNetworks(),
  ])

  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('new.title')}
        description={
          isNovato
            ? t('new.subtitle_novato')
            : t('new.subtitle_full')
        }
        backLink={{ href: '/cards', label: t('back_label') }}
      />

      {isNovato ? (
        <CreateNovatoCreditCardForm institutions={institutions} networks={networks} />
      ) : (
        <CreateCreditCardForm institutions={institutions} networks={networks} />
      )}
    </div>
  )
}

export default NewCardPage
