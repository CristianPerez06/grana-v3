import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { getShowCents } from '@/lib/preferences'
import { locales, type Locale } from '@/lib/i18n/config'
import { SettingsClient } from './_components/settings-client'
import { SettingsSection } from './_components/settings-section'

const SettingsPage = async () => {
  const showCents = await getShowCents()
  const locale = (await getLocale()) as Locale
  const t = await getTranslations('settings')

  const localeLabels: Record<Locale, string> = {
    es: t('language.es'),
    en: t('language.en'),
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SettingsClient
        initialShowCents={showCents}
        initialLocale={locale}
        locales={locales}
        localeLabels={localeLabels}
        displaySectionTitle={t('display.label')}
        showCentsLabel={t('display.show_cents.label')}
        showCentsDescription={t('display.show_cents.description')}
        languageSectionTitle={t('language.label')}
        languageAriaLabel={t('language.label')}
        languageRowLabel={t('language.row_label')}
        languageRowDescription={t('language.description')}
      />

      <SettingsSection title={t('categories.label')}>
        <Link
          href="/settings/categories"
          className="flex min-h-[68px] items-center justify-between gap-[18px] px-[18px] py-4 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-text">{t('categories.manage_cta')}</p>
            <p className="mt-0.5 text-[13px] text-text-muted">{t('categories.description')}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-text-soft" aria-hidden />
        </Link>
      </SettingsSection>

      <SettingsSection title={t('security.label')}>
        <Link
          href="/settings/password"
          className="flex min-h-[68px] items-center justify-between gap-[18px] px-[18px] py-4 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-text">
              {t('security.change_password.cta')}
            </p>
            <p className="mt-0.5 text-[13px] text-text-muted">
              {t('security.change_password.description')}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-text-soft" aria-hidden />
        </Link>
      </SettingsSection>
    </div>
  )
}

export default SettingsPage
