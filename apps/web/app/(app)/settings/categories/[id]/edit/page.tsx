import { notFound, redirect } from 'next/navigation'
import { getCategoryById } from '@/lib/categories/queries'
import { createClient } from '@/lib/supabase/server'
import { EditCategoryForm } from './_components/edit-category-form'

type Props = { params: Promise<{ id: string }> }

const EditCategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(id)
  if (!category || category.user_id !== user.id) notFound()

  return (
    <div className="max-w-md">
      <EditCategoryForm category={category} />
    </div>
  )
}

export default EditCategoryPage
