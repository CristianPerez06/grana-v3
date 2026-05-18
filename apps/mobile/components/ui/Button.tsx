import { ActivityIndicator, Pressable, Text } from 'react-native'

type Props = {
  title: string
  onPress: () => void
  loading?: boolean
  variant?: 'primary' | 'ghost'
}

export function Button({ title, onPress, loading = false, variant = 'primary' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`h-12 items-center justify-center rounded-lg px-4 ${
        variant === 'primary' ? 'bg-primary' : 'bg-transparent'
      } ${loading ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fafafa' : '#171717'} />
      ) : (
        <Text
          className={`text-base font-semibold ${
            variant === 'primary' ? 'text-primary-foreground' : 'text-primary'
          }`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}
