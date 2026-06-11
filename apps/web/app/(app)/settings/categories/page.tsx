import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAllCategories } from '@/lib/categories/queries'
import { CategoryList } from './_components/category-list'

const CategoriesPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations()
  const categories = await getAllCategories(supabase)

  return <CategoryList categories={categories} t={t} />
}

export default CategoriesPage
