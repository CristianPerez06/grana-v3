'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CategorySuggestion } from '@/lib/transactions/category-suggestion'

type Props = {
  suggestion: CategorySuggestion
  onApply: () => void
}

/**
 * Non-blocking category suggestion (Capa 1, historial). Shows the category the
 * user picked last time for this description and WHY — tapping applies it. It
 * suggests and teaches; it never auto-fills (pilar "sugiere y enseña, no impone").
 */
export const CategorySuggestionChip = ({ suggestion, onApply }: Props) => {
  const t = useTranslations('transactions')

  return (
    <button
      type="button"
      onClick={onApply}
      className="flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
    >
      <Sparkles size={13} aria-hidden />
      {t('category_suggestion.chip', { category: suggestion.categoryName })}
    </button>
  )
}
