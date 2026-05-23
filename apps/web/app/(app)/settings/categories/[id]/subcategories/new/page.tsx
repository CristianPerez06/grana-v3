import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCategoryById } from '@/lib/categories/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateSubcategoryForm } from './_components/create-subcategory-form'

type Props = { params: Promise<{ id: string }> }

const NewSubcategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(id)
  if (!category || category.user_id !== user.id) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title="Nueva subcategoría"
        description={category.name}
        backLink={{
          href: `/settings/categories/${id}/subcategories`,
          label: 'Subcategorías',
        }}
      />
      <CreateSubcategoryForm categoryId={id} />
    </div>
  )
}

export default NewSubcategoryPage
