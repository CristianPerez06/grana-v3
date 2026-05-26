'use client'

import { Lightbulb } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Props = {
  description: string
  categoryName: string
}

/**
 * Pedagogical hint — the promise that complements the history chip (Capa 1).
 * When the user categorizes a NEW description (one with no prior history match),
 * this tells them that next time they log it we'll suggest the same category. It
 * teaches the history suggestion before the user ever sees it, and nudges them to
 * write descriptions (which is what feeds the suggestion). Purely informational:
 * unlike the chip, it is NOT actionable — there is nothing to tap.
 */
export const CategorySuggestionHint = ({ description, categoryName }: Props) => {
  const t = useTranslations('transactions')
  const shown = description.length > 40 ? `${description.slice(0, 40)}…` : description

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Lightbulb size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span>{t('category_suggestion.hint', { description: shown, category: categoryName })}</span>
    </p>
  )
}
