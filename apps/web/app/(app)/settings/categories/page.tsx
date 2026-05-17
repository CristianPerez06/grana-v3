import Link from 'next/link'
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
  const categories = await getAllCategories(user.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná tus categorías de ingresos y gastos.
          </p>
        </div>
        <Link
          href="/settings/categories/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Agregar
        </Link>
      </div>
      <CategoryList categories={categories} t={t} />
    </div>
  )
}

export default CategoriesPage
