import { readFileSync } from 'node:fs'
import path from 'node:path'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidateAfterCategoryMutation } from '@/lib/transactions/invalidation'

const repoRoot = path.resolve(__dirname, '../../../../..')

const seed = async (qc: QueryClient, key: readonly unknown[], value: unknown) => {
  await qc.prefetchQuery({ queryKey: key, queryFn: async () => value })
}

describe('invalidateAfterCategoryMutation', () => {
  it('the `categories` prefix reaches both platforms’ catalog keys', async () => {
    // The whole point of invalidating the prefix instead of the exact key: web
    // caches the catalog under ['categories','tree'] and mobile under
    // ['categories','all']. A call site shouldn't have to know which.
    const qc = new QueryClient()
    await seed(qc, ['categories', 'tree'], 'web-catalog')
    await seed(qc, ['categories', 'all'], 'mobile-catalog')
    await seed(qc, ['accounts', 'list'], 'untouched')

    invalidateAfterCategoryMutation(qc)

    const state = (key: readonly unknown[]) => qc.getQueryState(key)
    expect(state(['categories', 'tree'])?.isInvalidated).toBe(true)
    expect(state(['categories', 'all'])?.isInvalidated).toBe(true)
    expect(state(['accounts', 'list'])?.isInvalidated).toBe(false)
  })

  it('also refreshes the filter-options universe', async () => {
    const qc = new QueryClient()
    await seed(qc, ['transactions', 'filter-options'], 'filters')
    invalidateAfterCategoryMutation(qc)
    expect(qc.getQueryState(['transactions', 'filter-options'])?.isInvalidated).toBe(true)
  })
})

// ── Call-site coverage ───────────────────────────────────────────────────────
// The bug was never that the helper was wrong — it was that archive and delete
// never called it, so the picker kept offering rows for up to the catalog's
// 15-minute staleTime. Unit-testing the helper alone would not have caught that,
// so these assert on the call sites themselves.

const readSource = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8')

const WEB_CALL_SITES = [
  'apps/web/app/(app)/settings/categories/_components/category-row.tsx',
  'apps/web/app/(app)/settings/categories/[id]/subcategories/_components/subcategory-list.tsx',
  'apps/web/app/(app)/settings/categories/new/_components/create-category-form.tsx',
  'apps/web/app/(app)/settings/categories/[id]/subcategories/new/_components/create-subcategory-form.tsx',
  'apps/web/app/(app)/settings/categories/[id]/edit/_components/edit-category-form.tsx',
]

const MOBILE_CALL_SITES = [
  'apps/mobile/components/categories/CategoryRow.tsx',
  'apps/mobile/components/categories/SubcategoryList.tsx',
  'apps/mobile/components/categories/CreateCategoryForm.tsx',
  'apps/mobile/components/categories/EditCategoryForm.tsx',
  'apps/mobile/components/categories/CreateSubcategoryForm.tsx',
]

describe('every category mutation call site invalidates the catalog', () => {
  it.each([...WEB_CALL_SITES, ...MOBILE_CALL_SITES])('%s', (file) => {
    expect(readSource(file)).toContain('invalidateAfterCategoryMutation')
  })

  it('archive and delete each invalidate, not just the create paths', () => {
    // The two handlers that were missing it. A `revalidatePath` in the server
    // action does nothing for the TanStack cache the picker reads.
    for (const file of [WEB_CALL_SITES[0], WEB_CALL_SITES[1], ...MOBILE_CALL_SITES.slice(0, 2)]) {
      const source = readSource(file)
      const calls = source.split('invalidateAfterCategoryMutation(').length - 1
      // One import + one call per handler (archive, delete).
      expect(calls).toBeGreaterThanOrEqual(2)
    }
  })
})
