import { getTranslations } from 'next-intl/server'
import { RouteNotFound } from '@/components/ui/route-not-found'

const CategoriesNotFound = async () => {
  const t = await getTranslations('notFound.categories')
  return (
    <RouteNotFound
      title={t('title')}
      description={t('description')}
      backHref="/settings/categories"
      backLabel={t('back_label')}
    />
  )
}

export default CategoriesNotFound
