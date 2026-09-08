import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCategoryById } from '@/lib/categories/queries'
import { getHousehold } from '@grana/shared'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { EditCategoryForm } from './_components/edit-category-form'

type Props = { params: Promise<{ id: string }> }

const EditCategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(supabase, id)
  // Reachable = visible under RLS: own, or the household's. Only system rows
  // are read-only here.
  if (!category || category.user_id === null) notFound()

  const tCat = await getTranslations('settings.categories')
  const household = await getHousehold(supabase)

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader title={tCat('edit.title')} />
      <EditCategoryForm category={category} hasHousehold={household !== null} />
    </div>
  )
}

export default EditCategoryPage
