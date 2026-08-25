import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PageHeader } from '../../../components/ui/PageHeader'
import { LanguageSwitcher } from '../../../components/settings/LanguageSwitcher'
import { SettingsSection } from '../../../components/settings/SettingsSection'
import { ShowCentsToggle } from '../../../components/settings/ShowCentsToggle'
import { usePreferences } from '../../../lib/preferences-context'
import { useLocale, useSetLocale, useT } from '../../../lib/locale-context'
import { locales, type Locale } from '../../../lib/locale'

export default function SettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const t = useT()
  const { showCents, setShowCents } = usePreferences()
  const locale = useLocale()
  const setLocale = useSetLocale()

  const [centsPending, setCentsPending] = useState(false)
  const [localePending, setLocalePending] = useState(false)

  const handleToggleCents = async (next: boolean) => {
    setCentsPending(true)
    try {
      await setShowCents(next)
    } finally {
      setCentsPending(false)
    }
  }

  const handleSelectLocale = async (next: Locale) => {
    setLocalePending(true)
    try {
      await setLocale(next)
    } finally {
      setLocalePending(false)
    }
  }

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('settings.title')}
        backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}
      />
      <ScrollView
        contentContainerClassName="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-col gap-6">
        <SettingsSection title={t('settings.display.label')}>
          <ShowCentsToggle
            value={showCents}
            onValueChange={handleToggleCents}
            disabled={centsPending}
            label={t('settings.display.show_cents.label')}
            description={t('settings.display.show_cents.description')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.language.label')}>
          <LanguageSwitcher<Locale>
            current={locale}
            locales={locales}
            onSelect={handleSelectLocale}
            disabled={localePending}
            renderLabel={(value) => t(`settings.language.${value}`)}
            ariaLabel={t('settings.language.label')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.categories.label')}>
          <Pressable
            onPress={() => router.push('/(app)/settings/categories')}
            accessibilityRole="link"
            className="-m-4 flex-row items-center justify-between rounded-2xl p-4 active:bg-emerald-soft"
          >
            <Text className="text-sm font-medium text-text">
              {t('settings.categories.manage_cta')}
            </Text>
            <Text className="text-text-soft">→</Text>
          </Pressable>
        </SettingsSection>

        <SettingsSection title={t('settings.security.label')}>
          <Pressable
            onPress={() => router.push('/(app)/settings/password')}
            accessibilityRole="link"
            className="-m-4 flex-row items-center justify-between gap-4 rounded-2xl p-4 active:bg-emerald-soft"
          >
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-text">
                {t('settings.security.change_password.cta')}
              </Text>
              <Text className="mt-0.5 text-xs text-text-muted">
                {t('settings.security.change_password.description')}
              </Text>
            </View>
            <Text className="text-text-soft">→</Text>
          </Pressable>
        </SettingsSection>
        </View>
      </ScrollView>
    </View>
  )
}
