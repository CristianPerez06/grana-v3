import { Linking, Text, View } from 'react-native'
import { useT } from '../lib/locale-context'
import { Button } from './ui/Button'

/**
 * The whole app, replaced.
 *
 * Deliberately a dead end: there is no dismiss and no "later". This build can no
 * longer keep the user's data correct — it does not run the generator that
 * materializes their vencimientos, so past due occurrences would silently stop
 * existing for them — and letting them keep going produces a wrong ledger rather
 * than an inconvenience.
 *
 * The link is what the server gave us and may be missing (the App Store id does
 * not exist until the app is published). Without it the screen still has to say
 * why the app stopped, so the button is what disappears, not the explanation.
 */
export function UpdateRequiredScreen({ storeUrl }: { storeUrl: string | null }) {
  const t = useT()

  return (
    <View
      accessibilityRole="alert"
      className="flex-1 items-center justify-center gap-4 px-8"
    >
      <Text className="text-center text-[20px] font-extrabold text-text">
        {t('app_update.title')}
      </Text>
      <Text className="text-center text-[14px] leading-5 text-text-muted">
        {t('app_update.body')}
      </Text>
      {storeUrl ? (
        <View className="w-full max-w-xs">
          <Button
            variant="primary"
            size="lg"
            onPress={() => void Linking.openURL(storeUrl).catch(() => {})}
            title={t('app_update.action')}
          />
        </View>
      ) : null}
    </View>
  )
}
