import { getTranslations } from 'next-intl/server'
import { RouteNotFound } from '@/components/ui/route-not-found'

const AppNotFound = async () => {
  const t = await getTranslations('notFound.generic')
  return (
    <RouteNotFound
      title={t('title')}
      description={t('description')}
      backHref="/dashboard"
      backLabel={t('back_label')}
    />
  )
}

export default AppNotFound
