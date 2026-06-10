'use client'

import type { LanguageSwitcherProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n/config'

export const LanguageSwitcher = ({
  current,
  locales,
  onSelect,
  disabled = false,
  renderLabel,
  ariaLabel,
  label,
  description,
}: LanguageSwitcherProps<Locale>) => {
  const control = (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-lg)] bg-[#EEF1F5] p-1"
    >
      {locales.map((locale) => {
        const active = current === locale
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => {
              if (active || disabled) return
              onSelect(locale)
            }}
            className={cn(
              'min-h-8 rounded-[10px] px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'bg-card text-text shadow-[0_1px_3px_rgba(11,26,43,0.08)]'
                : 'cursor-pointer text-text-muted',
            )}
          >
            {renderLabel(locale)}
          </button>
        )
      })}
    </div>
  )

  // Control-only when no row copy is supplied (e.g. a future mobile consumer
  // that hasn't built its settings row). With `label`, render as a settings
  // row — copy left, control right — symmetric with `ShowCentsToggle`.
  if (!label && !description) return control

  return (
    <div className="flex min-h-[68px] items-center justify-between gap-[18px] px-[18px] py-4">
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold text-text">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
      </div>
      {control}
    </div>
  )
}
