import { getTranslations } from 'next-intl/server'
import {
  buildCategorySlices,
  type CategorySlice,
  type CategorySliceInput,
} from '@grana/money-logic'
import { monthOf } from '@/lib/transactions/filters'
import { getMonthCategoryBreakdown, UNCATEGORIZED_ID } from '@/lib/transactions/queries'
import { translateCategoryLabel } from '@/lib/categories/display'
import { CategoryTeaser } from './category-teaser'
import { SectionFallback } from '@/components/ui/section-fallback'

type Props = {
  today: Date
}

export const CategoryTeaserContainer = async ({ today }: Props) => {
  const t = await getTranslations('dashboard')
  const tTx = await getTranslations('transactions')
  const tRoot = await getTranslations()

  // Top-3 slices for a currency: relabel the uncategorized sentinel and
  // translate system categories before slicing.
  const topSlices = (input: CategorySliceInput[]): CategorySlice[] =>
    buildCategorySlices(
      input.map((i) =>
        i.categoryId === UNCATEGORIZED_ID
          ? { ...i, label: tTx('spending.uncategorized') }
          : {
              ...i,
              label:
                translateCategoryLabel(i.label, i.canonicalName ?? null, i.isSystem ?? false, tRoot) ??
                i.label,
            },
      ),
      { topN: 3, othersLabel: tTx('spending.others') },
    ).slices.slice(0, 3)

  let arsSlices: CategorySlice[]
  let usdSlices: CategorySlice[]
  try {
    const breakdown = await getMonthCategoryBreakdown(monthOf(today))
    arsSlices = topSlices(breakdown.ARS)
    usdSlices = topSlices(breakdown.USD)
  } catch {
    return <SectionFallback message={t('spending.error')} />
  }

  return (
    <CategoryTeaser
      title={t('spending.title')}
      viewAllLabel={t('spending.view_all')}
      href="/transactions"
      slices={arsSlices}
      usdSlices={usdSlices}
    />
  )
}
