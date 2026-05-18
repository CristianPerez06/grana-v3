import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCategoryById, getSubcategoriesByCategoryId } from '@/lib/categories/queries'
import { getCategoryName, getSubcategoryName } from '@/lib/categories/display'
import { SubcategoryList } from './_components/subcategory-list'

type Props = { params: Promise<{ id: string }> }

const SubcategoriesPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(id)
  if (!category) notFound()

  const t = await getTranslations()
  const rawSubcategories = await getSubcategoriesByCategoryId(id)
  const isSystem = category.user_id === null
  const categoryDisplayName = getCategoryName(category, t)
  const subcategories = rawSubcategories.map((sub) => ({
    ...sub,
    displayName: getSubcategoryName(sub, t),
  }))

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/categories"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Categorías
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subcategorías</h1>
          <p className="mt-1 text-sm text-muted-foreground">{categoryDisplayName}</p>
        </div>
        {!isSystem && (
          <Link
            href={`/settings/categories/${id}/subcategories/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Agregar
          </Link>
        )}
      </div>
      <SubcategoryList
        subcategories={subcategories}
        categoryId={id}
        isSystem={isSystem}
      />
    </div>
  )
}

export default SubcategoriesPage
