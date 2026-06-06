import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { SubcategoriesHeader } from './_components/subcategories-header'

const SubcategoriesLayout = async ({ children }: { children: React.ReactNode }) => {
  const tCat = await getTranslations('settings.categories')

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <Link
        href="/settings/categories"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${tCat('label')}`}
      </Link>
      <SubcategoriesHeader />
      {children}
    </div>
  )
}

export default SubcategoriesLayout
