import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const EditCategoryLayout = async ({ children }: { children: React.ReactNode }) => {
  const tCat = await getTranslations('settings.categories')

  return (
    <>
      <Link
        href="/settings/categories"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${tCat('label')}`}
      </Link>
      {children}
    </>
  )
}

export default EditCategoryLayout
