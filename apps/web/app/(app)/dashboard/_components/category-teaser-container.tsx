import { getTranslations } from 'next-intl/server'
import { buildCategorySlices, type CategorySlice } from '@grana/money-logic'
import { monthOf } from '@/lib/transactions/filters'
import { getMonthCategoryBreakdown, UNCATEGORIZED_ID } from '@/lib/transactions/queries'
import { CategoryTeaser } from './category-teaser'
import { SectionFallback } from './section-fallback'

type Props = {
  today: Date
}

export const CategoryTeaserContainer = async ({ today }: Props) => {
  const t = await getTranslations('dashboard')
  const tTx = await getTranslations('transactions')

  let teaserSlices: CategorySlice[]
  try {
    const breakdown = await getMonthCategoryBreakdown(monthOf(today))
    teaserSlices = buildCategorySlices(
      breakdown.ARS.map((i) =>
        i.categoryId === UNCATEGORIZED_ID
          ? { ...i, label: tTx('spending.uncategorized') }
          : i,
      ),
      { topN: 3, othersLabel: tTx('spending.others') },
    ).slices.slice(0, 3)
  } catch {
    return <SectionFallback message={t('spending.error')} />
  }

  return (
    <CategoryTeaser
      title={t('spending.title')}
      viewAllLabel={t('spending.view_all')}
      href="/transactions"
      slices={teaserSlices}
    />
  )
}
