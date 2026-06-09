import { getTranslations } from 'next-intl/server'
import { RouteNotFound } from '@/components/ui/route-not-found'

const TransactionsNotFound = async () => {
  const t = await getTranslations('notFound.transactions')
  return (
    <RouteNotFound
      title={t('title')}
      description={t('description')}
      backHref="/transactions"
      backLabel={t('back_label')}
    />
  )
}

export default TransactionsNotFound
