import { Text, View } from 'react-native'
import type { RouteErrorProps } from '@grana/ui-contracts'
import { useT } from '../../lib/locale-context'
import { Button } from './Button'

export function RouteError({ error, onRetry, className }: RouteErrorProps) {
  const t = useT()
  const showDetails = __DEV__

  return (
    <View
      accessibilityRole="alert"
      className={`flex-1 items-center justify-center gap-4 px-6 py-12 ${className ?? ''}`}
    >
      <Text className="text-center text-lg font-semibold text-text">
        {t('error.generic_title')}
      </Text>
      {showDetails && error?.message ? (
        <Text className="max-w-md text-center font-mono text-xs text-text-soft">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </Text>
      ) : null}
      <View className="w-auto">
        <Button variant="primary" size="md" onPress={onRetry}>
          {t('error.retry_action')}
        </Button>
      </View>
    </View>
  )
}
