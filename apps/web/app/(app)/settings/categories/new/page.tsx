import { PageHeader } from '@/components/ui/page-header'
import { CreateCategoryForm } from './_components/create-category-form'

const NewCategoryPage = () => {
  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title="Nueva categoría"
        description="Agregá una categoría personalizada."
        backLink={{ href: '/settings/categories', label: 'Categorías' }}
      />
      <CreateCategoryForm />
    </div>
  )
}

export default NewCategoryPage
