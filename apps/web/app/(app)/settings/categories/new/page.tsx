import { getTranslations } from 'next-intl/server'
import { getHousehold } from '@grana/shared'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCategoryForm } from './_components/create-category-form'

const NewCategoryPage = async () => {
  const tCat = await getTranslations('settings.categories')
  const supabase = await createClient()
  const household = await getHousehold(supabase)

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title={tCat('new.title')}
        description={tCat('description')}
      />
      <CreateCategoryForm hasHousehold={household !== null} />
    </div>
  )
}

export default NewCategoryPage
