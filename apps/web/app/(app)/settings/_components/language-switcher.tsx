'use client'

import type { LanguageSwitcherProps } from '@grana/ui-contracts'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n/config'

export const LanguageSwitcher = ({
  current,
  locales,
  onSelect,
  disabled = false,
  renderLabel,
  ariaLabel,
}: LanguageSwitcherProps<Locale>) => {
  return (
    <div className="inline-flex items-center gap-1" aria-label={ariaLabel}>
      {locales.map((locale) => (
        <Button
          key={locale}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={current === locale}
          disabled={disabled}
          onClick={() => {
            if (locale === current || disabled) return
            onSelect(locale)
          }}
          className={
            current === locale
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground'
          }
        >
          {renderLabel(locale)}
        </Button>
      ))}
    </div>
  )
}
