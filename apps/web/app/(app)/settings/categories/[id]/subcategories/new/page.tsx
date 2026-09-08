import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCategoryById } from '@/lib/categories/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateSubcategoryForm } from './_components/create-subcategory-form'

type Props = { params: Promise<{ id: string }> }

const NewSubcategoryPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const category = await getCategoryById(supabase, id)
  // System categories accept new subcategories from anyone; own and household
  // ones from whoever can read them (RLS), which is the owner or a member.
  if (!category) notFound()

  const tCat = await getTranslations('settings.categories')

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader title={tCat('subcategories.new.title')} />
      <CreateSubcategoryForm categoryId={id} />
    </div>
  )
}

export default NewSubcategoryPage
