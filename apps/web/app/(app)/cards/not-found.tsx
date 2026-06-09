import { getTranslations } from 'next-intl/server'
import { RouteNotFound } from '@/components/ui/route-not-found'

const CardsNotFound = async () => {
  const t = await getTranslations('notFound.cards')
  return (
    <RouteNotFound
      title={t('title')}
      description={t('description')}
      backHref="/cards"
      backLabel={t('back_label')}
    />
  )
}

export default CardsNotFound
