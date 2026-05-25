import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { getShowCents } from '@/lib/preferences'
import { locales, type Locale } from '@/lib/i18n/config'
import { PageHeader } from '@/components/ui/page-header'
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
    <div className="flex flex-col gap-8 max-w-2xl">
      <PageHeader title={t('title')} />

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
      />

      <SettingsSection title={t('categories.label')}>
        <Link
          href="/settings/categories"
          className="-m-4 block rounded-lg p-4 text-sm font-medium hover:bg-muted/40 transition-colors flex items-center justify-between"
        >
          {t('categories.manage_cta')}
          <span className="text-muted-foreground">→</span>
        </Link>
      </SettingsSection>
    </div>
  )
}

export default SettingsPage
