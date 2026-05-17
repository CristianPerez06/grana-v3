import Link from 'next/link'
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
  if (!category || category.user_id !== user.id) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-3">
        <Link
          href={`/settings/categories/${id}/subcategories`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Subcategorías
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva subcategoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">{category.name}</p>
      </div>
      <CreateSubcategoryForm categoryId={id} />
    </div>
  )
}

export default NewSubcategoryPage
