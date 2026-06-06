import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCategoryById, getSubcategoriesByCategoryId } from '@/lib/categories/queries'
import { getSubcategoryName } from '@/lib/categories/display'
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
  const subcategories = rawSubcategories.map((sub) => ({
    ...sub,
    displayName: getSubcategoryName(sub, t),
  }))

  return <SubcategoryList subcategories={subcategories} />
}

export default SubcategoriesPage
