import Link from 'next/link'
import { CreateCategoryForm } from './_components/create-category-form'

const NewCategoryPage = () => {
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva categoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agregá una categoría personalizada.
        </p>
      </div>
      <CreateCategoryForm />
    </div>
  )
}

export default NewCategoryPage
