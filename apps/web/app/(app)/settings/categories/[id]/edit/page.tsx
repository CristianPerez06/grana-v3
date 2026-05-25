import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCategoryById } from '@/lib/categories/queries'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { EditCategoryForm } from './_components/edit-category-form'

type Props = { params: Promise<{ id: string }> }

const EditCategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(id)
  if (!category || category.user_id !== user.id) notFound()

  const t = await getTranslations('settings.categories')

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader
        title={t('edit.title')}
        description={category.name}
        backLink={{ href: '/settings/categories', label: t('label') }}
      />
      <EditCategoryForm category={category} />
    </div>
  )
}

export default EditCategoryPage
