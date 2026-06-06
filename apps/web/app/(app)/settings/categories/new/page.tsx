import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCategoryForm } from './_components/create-category-form'

const NewCategoryPage = async () => {
  const tCat = await getTranslations('settings.categories')

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title={tCat('new.title')}
        description={tCat('description')}
      />
      <CreateCategoryForm />
    </div>
  )
}

export default NewCategoryPage
