'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { setLocaleAction } from '@/app/_actions/set-locale'
import { locales, type Locale } from '@/lib/i18n/config'

export const LanguageSwitcher = () => {
  const t = useTranslations('settings.language')
  const current = useLocale() as Locale
  const [pending, startTransition] = useTransition()

  const onSelect = (locale: Locale) => {
    if (locale === current || pending) return
    startTransition(() => {
      void setLocaleAction(locale)
    })
  }

  return (
    <div className="inline-flex items-center gap-1" aria-label={t('label')}>
      {locales.map((locale) => (
        <Button
          key={locale}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={current === locale}
          disabled={pending}
          onClick={() => onSelect(locale)}
          className={
            current === locale
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground'
          }
        >
          {t(locale)}
        </Button>
      ))}
    </div>
  )
}
