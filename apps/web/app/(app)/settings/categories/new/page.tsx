import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCategoryForm } from './_components/create-category-form'

const NewCategoryPage = async () => {
  const t = await getTranslations('settings.categories')

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title={t('new.title')}
        description={t('description')}
        backLink={{ href: '/settings/categories', label: t('label') }}
      />
      <CreateCategoryForm />
    </div>
  )
}

export default NewCategoryPage
