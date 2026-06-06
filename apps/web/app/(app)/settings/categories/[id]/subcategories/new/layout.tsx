import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

const NewSubcategoryLayout = async ({ children, params }: Props) => {
  const { id } = await params
  const tCat = await getTranslations('settings.categories')

  return (
    <>
      <Link
        href={`/settings/categories/${id}/subcategories`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${tCat('subcategories.title')}`}
      </Link>
      {children}
    </>
  )
}

export default NewSubcategoryLayout
