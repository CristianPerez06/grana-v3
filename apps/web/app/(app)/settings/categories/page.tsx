import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAllCategories } from '@/lib/categories/queries'
import { getHousehold } from '@grana/shared'
import { CategoryList } from './_components/category-list'

const CategoriesPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations()
  const [categories, household] = await Promise.all([
    getAllCategories(supabase),
    getHousehold(supabase),
  ])

  return <CategoryList categories={categories} t={t} hasHousehold={household !== null} />
}

export default CategoriesPage
