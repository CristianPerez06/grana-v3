'use client'

import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * The category already belongs to the household. The switch stays on and
   * cannot be turned off: other members may already point movements at it, so
   * the way back to "own" is not offered (spec `categories`).
   */
  locked?: boolean
}

/**
 * "Es del hogar" row of the category form. Rendered only when the user has an
 * active household — without one there is nothing to put a category into.
 * Mirrors `apps/mobile/components/categories/HouseholdScopeRow.tsx`.
 */
export const HouseholdScopeField = ({ checked, onChange, locked = false }: Props) => {
  const t = useTranslations('settings.categories')

  return (
    <div className="flex items-start justify-between gap-4 rounded-[14px] border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{t('form.household_label')}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {locked ? t('form.household_locked') : t('form.household_help')}
        </p>
      </div>
      <Switch
        checked={checked}
        onValueChange={onChange}
        disabled={locked}
        ariaLabel={t('form.household_label')}
        className="mt-0.5"
      />
    </div>
  )
}
