import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { categoryScope } from '@/lib/categories/types'
import { getCategoryName } from '@/lib/categories/display'
import { CategoryRow } from './category-row'

type Props = {
  categories: CategoryWithSubcategories[]
  t: (key: string) => string
  /** Whether the user belongs to an active household: gates the "Es del hogar" control in the forms. */
  hasHousehold: boolean
}

const sectionTitleClass =
  'text-xs font-extrabold uppercase tracking-[0.08em] text-text-muted'
const panelClass = 'overflow-hidden rounded-[18px] border border-border bg-card'

// `subcategories` arrives already filtered to active rows by `getAllCategories`
// — no defensive re-filter here on purpose: if the read ever hands out archived
// items again, this list is where we want it to show, not be papered over.
export const CategoryList = ({ categories, t, hasHousehold }: Props) => {
  const system = categories.filter((c) => categoryScope(c) === 'system')
  const household = categories.filter((c) => categoryScope(c) === 'household')
  const user = categories.filter((c) => categoryScope(c) === 'own')

  return (
    <div className="flex flex-col gap-[26px]">
      {system.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className={sectionTitleClass}>
            {t('settings.categories.list.system_heading')}
          </h2>
          <div className={panelClass}>
            {system.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.length}
                scope="system"
                hasHousehold={hasHousehold}
              />
            ))}
          </div>
        </section>
      )}

      {/* The household's vocabulary, shared by every member. Absent without a
          household, and absent while it is empty: an empty group would only say
          "you could create one", which the form's switch already says. */}
      {household.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className={sectionTitleClass}>
            {t('settings.categories.list.household_heading')}
          </h2>
          <div className={panelClass}>
            {household.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.length}
                scope="household"
                hasHousehold={hasHousehold}
              />
            ))}
          </div>
        </section>
      )}

      {user.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className={sectionTitleClass}>
            {t('settings.categories.list.user_heading')}
          </h2>
          <div className={panelClass}>
            {user.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.length}
                scope="own"
                hasHousehold={hasHousehold}
              />
            ))}
          </div>
        </section>
      )}

      {categories.length === 0 && (
        <div className="rounded-[18px] border border-dashed border-border bg-card px-[22px] py-[42px] text-center">
          <p className="text-sm text-muted-foreground">
            {t('settings.categories.list.empty')}
          </p>
        </div>
      )}
    </div>
  )
}
