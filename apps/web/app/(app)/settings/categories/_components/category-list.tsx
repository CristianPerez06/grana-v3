import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { getCategoryName } from '@/lib/categories/display'
import { CategoryRow } from './category-row'

type Props = {
  categories: CategoryWithSubcategories[]
  t: (key: string) => string
}

export const CategoryList = ({ categories, t }: Props) => {
  const system = categories.filter((c) => c.user_id === null)
  const user = categories.filter((c) => c.user_id !== null)

  return (
    <div className="flex flex-col gap-8">
      {system.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Del sistema
          </h2>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {system.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.filter((s) => s.is_active).length}
                isSystem
              />
            ))}
          </div>
        </section>
      )}

      {user.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Propias
          </h2>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {user.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.filter((s) => s.is_active).length}
                isSystem={false}
              />
            ))}
          </div>
        </section>
      )}

      {categories.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No hay categorías todavía.
        </p>
      )}
    </div>
  )
}
