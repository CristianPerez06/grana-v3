'use client'

import { useState, useTransition } from 'react'
import { setShowCents } from '@/app/_actions/preferences'
import { setLocaleAction } from '@/app/_actions/set-locale'
import type { Locale } from '@/lib/i18n/config'
import { LanguageSwitcher } from './language-switcher'
import { SettingsSection } from './settings-section'
import { ShowCentsToggle } from './show-cents-toggle'

type Props = {
  initialShowCents: boolean
  initialLocale: Locale
  locales: readonly Locale[]
  localeLabels: Record<Locale, string>
  displaySectionTitle: string
  showCentsLabel: string
  showCentsDescription: string
  languageSectionTitle: string
  languageAriaLabel: string
}

export const SettingsClient = ({
  initialShowCents,
  initialLocale,
  locales,
  localeLabels,
  displaySectionTitle,
  showCentsLabel,
  showCentsDescription,
  languageSectionTitle,
  languageAriaLabel,
}: Props) => {
  const [showCents, setShowCentsState] = useState(initialShowCents)
  const [centsPending, startCentsTransition] = useTransition()
  const [localePending, startLocaleTransition] = useTransition()

  const handleToggleCents = (next: boolean) => {
    setShowCentsState(next)
    startCentsTransition(() => {
      void setShowCents(next)
    })
  }

  const handleSelectLocale = (locale: Locale) => {
    if (locale === initialLocale) return
    startLocaleTransition(() => {
      void setLocaleAction(locale)
    })
  }

  return (
    <>
      <SettingsSection title={displaySectionTitle}>
        <ShowCentsToggle
          value={showCents}
          onValueChange={handleToggleCents}
          disabled={centsPending}
          label={showCentsLabel}
          description={showCentsDescription}
        />
      </SettingsSection>

      <SettingsSection title={languageSectionTitle}>
        <LanguageSwitcher
          current={initialLocale}
          locales={locales}
          onSelect={handleSelectLocale}
          disabled={localePending}
          renderLabel={(locale) => localeLabels[locale]}
          ariaLabel={languageAriaLabel}
        />
      </SettingsSection>
    </>
  )
}
