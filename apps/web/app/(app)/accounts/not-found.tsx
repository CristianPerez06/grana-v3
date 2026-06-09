import { getTranslations } from 'next-intl/server'
import { RouteNotFound } from '@/components/ui/route-not-found'

const AccountsNotFound = async () => {
  const t = await getTranslations('notFound.accounts')
  return (
    <RouteNotFound
      title={t('title')}
      description={t('description')}
      backHref="/accounts"
      backLabel={t('back_label')}
    />
  )
}

export default AccountsNotFound
