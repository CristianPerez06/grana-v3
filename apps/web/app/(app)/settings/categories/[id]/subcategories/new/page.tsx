import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCategoryById } from '@/lib/categories/queries'
import { CreateSubcategoryForm } from './_components/create-subcategory-form'

type Props = { params: Promise<{ id: string }> }

const NewSubcategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(id)
  // Allow adding a subcategory under the user's own categories AND under system
  // categories (user_id === null) — per the categories spec. Only another user's
  // category is off-limits.
  if (!category || (category.user_id !== null && category.user_id !== user.id)) notFound()

  return (
    <div className="max-w-md">
      <CreateSubcategoryForm categoryId={id} />
    </div>
  )
}

export default NewSubcategoryPage
