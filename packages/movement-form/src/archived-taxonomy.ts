// Reachable as `@grana/movement-form/archived-taxonomy` as well as from the
// package root. The subpath exists for SERVER callers: the root entry re-exports
// `useMovementForm`, so importing a value from it drags `useState` into a React
// Server Component graph and fails `next build` (the edit context is built in an
// RSC). Everything in this file is pure and its only import is type-only, so the
// subpath pulls in no React at runtime — keep it that way.
import type { ArchivedTaxonomy, CategoryWithSubcategories } from './types'

/**
 * Graft the archived category/subcategory a movement is already classified with
 * back into the category catalog, so the edit form can render its own selection.
 *
 * The catalog serves active rows only (see `getAllCategories`), which is what
 * keeps archived items out of the create form. That same filter would leave an
 * older movement's classification unresolvable in edit — the picker would show
 * an empty field and a plain save could blank a category that was set.
 *
 * The graft is deliberately conditional on the CURRENT selection, not on edit
 * mode alone: the archived node is the movement's value, not a catalog entry.
 * The moment the user picks something else the ids stop matching and the node
 * drops out, so it can never be re-selected. On create there is no
 * `archivedTaxonomy` at all, so nothing is ever grafted.
 *
 * Returns the input array unchanged (same reference) when there is nothing to
 * graft, which is every call outside this narrow case.
 */
export function graftArchivedTaxonomy<C extends CategoryWithSubcategories>(
  categories: C[],
  archived: ArchivedTaxonomy | null | undefined,
  selection: { categoryId: string | null; subcategoryId: string | null },
): C[] {
  if (!archived) return categories

  const graftCategory =
    archived.category && archived.category.id === selection.categoryId
      ? archived.category
      : null
  const graftSubcategory =
    archived.subcategory && archived.subcategory.id === selection.subcategoryId
      ? archived.subcategory
      : null
  if (!graftCategory && !graftSubcategory) return categories

  // The archived category may already be present if the catalog ever starts
  // serving it again (reactivated in another tab); don't duplicate it.
  const hasCategory = graftCategory
    ? categories.some((c) => c.id === graftCategory.id)
    : false

  // The grafted node is built from the movement's embedded row, so it carries
  // whatever the detail read selected (name, canonical_name, user_id, icon,
  // color) but not necessarily every field of a caller's richer category type
  // — hence the cast. Renderers only read name/icon/is_active/subcategories off
  // it, and it exists for exactly one row that is already the form's value.
  let result =
    graftCategory && !hasCategory
      ? [...categories, { ...graftCategory, is_active: false } as unknown as C]
      : categories

  if (graftSubcategory) {
    // The parent is whatever category the form currently holds — an archived
    // subcategory can hang off a live category or off the grafted archived one.
    const parentId = selection.categoryId
    let touched = false
    const withSub = result.map((c) => {
      if (c.id !== parentId) return c
      if (c.subcategories.some((s) => s.id === graftSubcategory.id)) return c
      touched = true
      return {
        ...c,
        subcategories: [...c.subcategories, { ...graftSubcategory, is_active: false }],
      }
    })
    if (touched) result = withSub
  }

  return result
}

type TaxonomyRow = {
  id: string
  name: string
  canonical_name: string
  user_id: string | null
  is_active?: boolean
}

type CategoryRow = TaxonomyRow & {
  type?: 'income' | 'expense' | 'both'
  icon?: string | null
  color?: string | null
}

/**
 * Derive the `archivedTaxonomy` for an edit context from the movement's own
 * embedded category/subcategory. No extra read: the detail query the edit
 * context already runs carries both rows plus their `is_active`.
 *
 * Returns `null` when the classification is live, which is the common case.
 * Only `is_active === false` counts as archived — a read that didn't select
 * the column leaves it `undefined` and must not be treated as archived.
 */
export function archivedTaxonomyFrom(tx: {
  category?: CategoryRow | null
  subcategory?: TaxonomyRow | null
}): ArchivedTaxonomy | null {
  const category = tx.category?.is_active === false ? tx.category : null
  const subcategory = tx.subcategory?.is_active === false ? tx.subcategory : null
  if (!category && !subcategory) return null

  return {
    category: category
      ? {
          id: category.id,
          name: category.name,
          // Falls back to `both` so a node missing its type survives either
          // tab's filter — never hidden by an incomplete read.
          type: category.type ?? 'both',
          subcategories: [],
          is_active: false,
          // Carried so the renderer can resolve a system category's i18n name
          // and show its icon, exactly as it would for a live row.
          canonical_name: category.canonical_name,
          user_id: category.user_id,
          icon: category.icon ?? null,
          color: category.color ?? null,
        }
      : null,
    subcategory: subcategory
      ? {
          id: subcategory.id,
          name: subcategory.name,
          canonical_name: subcategory.canonical_name,
          user_id: subcategory.user_id,
          is_active: false,
        }
      : null,
  }
}

/**
 * A category is drillable only when it has subcategories the user can actually
 * pick. A grafted archived subcategory is the movement's current value, not an
 * option, so it must not make an otherwise flat category open a second level
 * containing nothing but an archived row.
 */
export function selectableSubcategories(
  category: Pick<CategoryWithSubcategories, 'subcategories'>,
): CategoryWithSubcategories['subcategories'] {
  return category.subcategories.filter((s) => s.is_active !== false)
}
